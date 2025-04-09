const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");const moment = require("moment"); // Ensure you have moment.js installed

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
                    MIN(CASE WHEN logs.action = 'login' AND logs.result = '1' THEN logs.created_at END) AS first_login_time,
                    MAX(CASE WHEN logs.action = 'logout' AND logs.result = '1' THEN logs.created_at END) AS last_logout_time
                FROM admin_login_logs AS logs
                INNER JOIN admins ON logs.admin_id = admins.id
                WHERE logs.action IN ('login', 'logout')
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

  activityList: async(logDate, adminId, callback) => {

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
