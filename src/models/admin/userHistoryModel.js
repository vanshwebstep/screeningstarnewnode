const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize"); const moment = require("moment"); // Ensure you have moment.js installed

const tatDelay = {
  index: async (callback) => {
    try {
      // Step 1: Fetch check-in/out records along with first login time per admin
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
          -- First login time (check-in)
          (
            SELECT MIN(logs.created_at)
            FROM admin_login_logs AS logs
            WHERE logs.admin_id = cio.admin_id AND logs.action = 'login' AND DATE(logs.created_at) = CURDATE()
          ) AS first_login_time
        FROM check_in_outs AS cio
        INNER JOIN admins a ON cio.admin_id = a.id
        WHERE DATE(cio.created_at) = CURDATE()
        ORDER BY cio.admin_id, cio.created_at ASC;
      `;

      const records = await sequelize.query(sql, {
        type: QueryTypes.SELECT,
      });

      if (records.length === 0) {
        return callback(null, { message: "No records found" });
      }

      // Step 2: Group and structure data per admin
      const grouped = {};

      for (const record of records) {
        const adminId = record.admin_id;

        if (!grouped[adminId]) {
          grouped[adminId] = {
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

        // Save first check-in
        if (isCheckIn && !grouped[adminId].first_check_in_time) {
          grouped[adminId].first_check_in_time = record.created_at;
        }

        // Update last check-out
        if (isCheckOut) {
          grouped[adminId].last_check_out_time = record.created_at;
        }

        // Push to check-in/out history
        grouped[adminId].check_in_outs.push({
          status: record.status,
          time: record.created_at,
        });
      }

      const result = Object.values(grouped);
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
