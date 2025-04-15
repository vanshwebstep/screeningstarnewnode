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
                    MIN(created_at) AS first_login_time,
                    -- Last logout time
                    MAX(created_at) AS last_logout_time,
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
