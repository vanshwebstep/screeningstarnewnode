const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize"); const moment = require("moment"); // Ensure you have moment.js installed

const tatDelay = {
  index: async (callback) => {
    // SQL query to retrieve applications, customers, branches, tat_days, and admin details
    const SQL = `
                SELECT 
                    logs.admin_id,
                    admins.name AS admin_name,
                    admins.profile_picture,
                    admins.email AS admin_email,
                    admins.mobile AS admin_mobile,
                    admins.emp_id,
                    -- First login time
                    MIN(logs.created_at) AS first_login_time,
                    -- Last logout time
                    MAX(logs.created_at) AS last_logout_time,
                    -- First login time
                    MIN(logs.created_at) AS created_at
                FROM admin_login_logs AS logs
                INNER JOIN admins ON logs.admin_id = admins.id
                WHERE logs.action IN ('login')
                GROUP BY logs.admin_id, DATE(logs.created_at)
                ORDER BY logs.admin_id, DATE(logs.created_at) DESC;
    `;
    const applicationResults = await sequelize.query(SQL, {
      type: QueryTypes.SELECT,
    });

    if (applicationResults.length === 0) {
      return callback(null, { message: "No records found" });
    }
    // Return the processed data
    return callback(null, applicationResults);

  },

  /*
  attendanceIndex: async (callback) => {
    try {
      const sql = `
        SELECT 
          cio.admin_id,
          a.name AS admin_name,
          a.profile_picture,
          a.email AS admin_email,
          a.mobile AS admin_mobile,
          a.emp_id,
          cio.status,
          cio.created_at,
          DATE(cio.created_at) AS record_date,
          (
            SELECT MIN(logs.created_at)
            FROM admin_login_logs AS logs
            WHERE logs.admin_id = cio.admin_id 
              AND logs.action = 'login'
              AND DATE(logs.created_at) = DATE(cio.created_at)
          ) AS first_login_time
        FROM check_in_outs AS cio
        INNER JOIN admins a ON cio.admin_id = a.id
        ORDER BY DATE(cio.created_at) DESC;
      `;

      const records = await sequelize.query(sql, {
        type: QueryTypes.SELECT,
      });

      if (records.length === 0) {
        return callback(null, { message: "No records found" });
      }

      // Step 2: Group and structure data per admin per day
      const grouped = {};

      for (const record of records) {
        const adminId = record.admin_id;
        const recordDate = record.record_date;

        if (!grouped[recordDate]) {
          grouped[recordDate] = {};
        }

        if (!grouped[recordDate][adminId]) {
          grouped[recordDate][adminId] = {
            date: recordDate,
            admin_id: adminId,
            admin_name: record.admin_name,
            profile_picture: record.profile_picture,
            admin_email: record.admin_email,
            admin_mobile: record.admin_mobile,
            emp_id: record.emp_id,
            first_login_time: record.first_login_time,
            first_check_in_time: null,
            last_check_out_time: null,
            check_in_outs: [],
          };
        }

        const isCheckIn = record.status === 'check-in';
        const isCheckOut = record.status === 'check-out';

        if (isCheckIn && !grouped[recordDate][adminId].first_check_in_time) {
          grouped[recordDate][adminId].first_check_in_time = record.created_at;
        }

        if (isCheckOut) {
          grouped[recordDate][adminId].last_check_out_time = record.created_at;
        }

        grouped[recordDate][adminId].check_in_outs.push({
          status: record.status,
          time: record.created_at,
        });
      }

      // Flatten into array sorted by date (newest first)
      const result = [];

      Object.keys(grouped)
        .sort((a, b) => new Date(b) - new Date(a)) // newest date first
        .forEach(date => {
          result.push(...Object.values(grouped[date]));
        });

      return callback(null, result);
    } catch (error) {
      console.error("Error in index:", error);
      return callback(error, null);
    }
  },
  */

  attendanceIndex: async (callback) => {
    try {
      // Step 1: Fetch all admins
      const admins = await sequelize.query(`
        SELECT id AS admin_id, name AS admin_name, profile_picture, email AS admin_email, mobile AS admin_mobile, emp_id
        FROM admins
      `, {
        type: QueryTypes.SELECT,
      });

      // Step 2: Fetch all check-ins/outs
      const attendanceRecords = await sequelize.query(`
        SELECT 
          cio.admin_id,
          cio.status,
          cio.created_at,
          DATE(cio.created_at) AS record_date,
          (
            SELECT MIN(logs.created_at)
            FROM admin_login_logs AS logs
            WHERE logs.admin_id = cio.admin_id 
              AND logs.action = 'login'
              AND DATE(logs.created_at) = DATE(cio.created_at)
          ) AS first_login_time
        FROM check_in_outs AS cio
        ORDER BY DATE(cio.created_at) DESC
      `, {
        type: QueryTypes.SELECT,
      });

      // Step 3: Fetch break data
      const breaks = await sequelize.query(`
        SELECT b.*
        FROM admin_breaks b
        INNER JOIN (
          SELECT admin_id, type, DATE(created_at) AS record_date, MAX(id) AS max_id
          FROM admin_breaks
          GROUP BY admin_id, type, DATE(created_at)
        ) latest
        ON b.id = latest.max_id
      `, {
        type: QueryTypes.SELECT,
      });

      // Step 4: Group all attendance and breaks
      const grouped = {};

      for (const record of attendanceRecords) {
        const date = record.record_date;
        const adminId = record.admin_id;

        if (!grouped[date]) grouped[date] = {};
        if (!grouped[date][adminId]) {
          grouped[date][adminId] = {
            date,
            admin_id: adminId,
            first_check_in_time: null,
            last_check_out_time: null,
            check_in_outs: [],
            breaks: [],
            first_login_time: record.first_login_time,
          };
        }

        const entry = grouped[date][adminId];

        const isCheckIn = record.status === 'check-in';
        const isCheckOut = record.status === 'check-out';

        if (isCheckIn) {
          if (!entry.first_check_in_time || new Date(record.created_at) < new Date(entry.first_check_in_time)) {
            entry.first_check_in_time = record.created_at;
          }
        }

        if (isCheckOut) {
          if (!entry.last_check_out_time || new Date(record.created_at) > new Date(entry.last_check_out_time)) {
            entry.last_check_out_time = record.created_at;
          }
        }

        entry.check_in_outs.push({
          status: record.status,
          time: record.created_at,
        });
      }

      for (const brk of breaks) {
        const date = brk.created_at.toISOString().split("T")[0];
        const adminId = brk.admin_id;

        if (!grouped[date]) grouped[date] = {};
        if (!grouped[date][adminId]) {
          grouped[date][adminId] = {
            date,
            admin_id: adminId,
            first_check_in_time: null,
            last_check_out_time: null,
            check_in_outs: [],
            breaks: [],
            first_login_time: null,
          };
        }

        grouped[date][adminId].breaks.push({
          type: brk.type,
          time: brk.created_at,
        });
      }

      // Step 5: Final result: ensure all admins exist even if no attendance or break
      const result = [];

      const allDates = Object.keys(grouped);
      for (const admin of admins) {
        for (const date of allDates) {
          const base = grouped[date][admin.admin_id] || {
            date,
            admin_id: admin.admin_id,
            first_check_in_time: null,
            last_check_out_time: null,
            check_in_outs: [],
            breaks: [],
            first_login_time: null,
          };

          result.push({
            ...base,
            admin_name: admin.admin_name,
            profile_picture: admin.profile_picture,
            admin_email: admin.admin_email,
            admin_mobile: admin.admin_mobile,
            emp_id: admin.emp_id,
          });
        }
      }

      // Optional: sort result by date descending
      result.sort((a, b) => new Date(b.date) - new Date(a.date));
      const filteredResult = result.filter(item => item.check_in_outs.length > 0 || item.breaks.length > 0);
      return callback(null, filteredResult);

      // return callback(null, result);
    } catch (error) {
      console.error("Error in index:", error);
      return callback(error, null);
    }
  },

  activityList: async (logDate, adminId, callback) => {

    const query = `SELECT * FROM \`admin_activity_logs\` WHERE \`admin_id\` = ? AND DATE(created_at) = ?;`;

    console.log("Database connection established successfully.");
    const results = await sequelize.query(query, {
      replacements: [adminId, logDate],
      type: QueryTypes.SELECT,
    });
    callback(null, results);
  }

};

// Helper function to handle query errors and release connection
function handleQueryError(err, connection, callback) {
  console.error("Query error:", err);

  callback(err, null);
}

module.exports = tatDelay;
