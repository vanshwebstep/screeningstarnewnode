const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const Admin = {
  list: async (callback) => {
    const sql = `SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\`, \`date_of_joining\`, \`designation\`, \`role\`, \`status\`, \`service_ids\`, \`permissions\` FROM \`admins\` ORDER BY \`created_at\` DESC`;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    callback(null, results);

  },

  filterAdmins: async ({ status, role }, callback) => {
    // console.log("filterAdmins called with:", { status, role });

    let sql = `
        SELECT 
            id, emp_id, name, role, profile_picture, email, 
            service_ids, status, mobile 
        FROM admins
    `;
    const conditions = [];
    const values = [];

    // Normalize status filter (expecting "1" or "0" as string)
    if (status !== undefined) {
      const statusValue = (status === "active" || status === "1") ? "1" : "0";
      conditions.push("status = ?");
      values.push(statusValue);
      // console.log("Applied status filter:", statusValue);
    }

    // Apply role filter if provided
    if (role) {
      conditions.push("role = ?");
      values.push(role);
      // console.log("Applied role filter:", role);
    }

    // Append conditions only if there are any filters
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    // console.log("Final SQL Query:", sql);
    // console.log("Query Values:", values);

    const results = await sequelize.query(sql, {
      replacements: values, // Positional replacements using ?
      type: QueryTypes.SELECT,
    });


    // console.log("Query Results:", results);
    callback(null, results);


  },

  create: async (data, callback) => {
    try {
      const {
        name,
        email,
        emp_id,
        date_of_joining,
        role,
        password,
        designation,
        permissions,
        service_ids,
        mobile, // Directly extracting mobile instead of parsing later
      } = data;

      const parsedMobile = parseInt(mobile, 10);

      // SQL query to check if any field already exists in the admins table
      const checkExistingQuery = `
        SELECT email, mobile, emp_id FROM \`admins\` WHERE \`email\` = ? OR \`mobile\` = ? OR \`emp_id\` = ?
      `;

      const existingAdmins = await sequelize.query(checkExistingQuery, {
        replacements: [email, parsedMobile, emp_id],
        type: QueryTypes.SELECT,
      });

      if (existingAdmins.length > 0) {
        const fieldMapping = {
          email: "email",
          mobile: "mobile",
          emp_id: "Employee ID",
        };

        const usedFields = [];

        for (const existingAdmin of existingAdmins) {
          for (const [key, label] of Object.entries(fieldMapping)) {
            if (existingAdmin[key] === data[key]) {
              usedFields.push(label);
            }
          }
        }

        if (usedFields.length > 0) {
          return callback(
            `Another admin is registered with the following ${[...new Set(usedFields)].join(" and ")}.`,
            null
          );
        }
      }

      let sql, queryParams;

      if (role.toLowerCase() === "admin") {
        sql = `
          INSERT INTO \`admins\` 
          (\`name\`, \`emp_id\`, \`mobile\`, \`email\`, \`date_of_joining\`, \`role\`, \`status\`, \`password\`, \`designation\`) 
          VALUES (?, ?, ?, ?, ?, ?, ?, md5(?), ?)
        `;

        queryParams = [
          name,
          emp_id,
          parsedMobile,
          email,
          date_of_joining,
          role,
          "1",
          password,
          designation,
        ];
      } else {
        sql = `
          INSERT INTO \`admins\` 
          (\`name\`, \`emp_id\`, \`mobile\`, \`email\`, \`date_of_joining\`, \`role\`, \`status\`, \`password\`, \`designation\`, \`permissions\`, \`service_ids\`) 
          VALUES (?, ?, ?, ?, ?, ?, ?, md5(?), ?, ?, ?)
        `;

        queryParams = [
          name,
          emp_id,
          parsedMobile,
          email,
          date_of_joining,
          role,
          "1",
          password,
          designation,
          permissions, // Ensure array values are stored correctly
          service_ids,
        ];
      }

      const insertResult = await sequelize.query(sql, {
        replacements: queryParams,
        type: QueryTypes.INSERT,
      });
      const insertId = insertResult[0];
      callback(null, { insertId });
    } catch (error) {
      console.error("Error in create function:", error);
      callback("An error occurred while creating the admin.", null);
    }
  },


  update: async (data, callback) => {
    const {
      id,
      name,
      email,
      emp_id,
      date_of_joining,
      role,
      status,
      designation,
      permissions,
      service_ids,
    } = data;

    const mobile = parseInt(data.mobile, 10);

    const checkExistingQuery = `
      SELECT * FROM \`admins\` 
      WHERE (\`email\` = ? OR \`mobile\` = ? OR \`emp_id\` = ?) AND \`id\` != ?
    `;

    const results = await sequelize.query(checkExistingQuery, {
      replacements: [email, mobile, emp_id, id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });


    if (results.length > 0) {
      const fieldMapping = {
        email: "email",
        mobile: "mobile",
        emp_id: "Employee ID",
      };

      const usedFields = [];

      // Loop through each result
      for (const existingAdmin of results) {
        console.log(`existingAdmin - `, existingAdmin);
        for (const [key, label] of Object.entries(fieldMapping)) {
          console.log(`key - `, key);
          console.log(`label - `, label);
          console.log(`existingAdmin[key] - `, existingAdmin[key]);

          if (existingAdmin[key] === eval(key)) {
            usedFields.push(label);
          }
        }
      }

      if (usedFields.length > 0) {
        return callback(
          `Another admin is registered with the following ${[
            ...new Set(usedFields),
          ].join(" and ")}.`,
          null
        );
      }
    }

    let sql;
    let queryParams;
    if (role.toLowerCase() === "admin") {
      // If no duplicates are found, proceed with updating the admin record
      sql = `
            UPDATE \`admins\` 
            SET 
              \`name\` = ?, 
              \`emp_id\` = ?, 
              \`mobile\` = ?, 
              \`email\` = ?, 
              \`date_of_joining\` = ?, 
              \`role\` = ?, 
              \`status\` = ?, 
              \`designation\` = ?
            WHERE \`id\` = ?
          `;

      queryParams = [
        name,
        emp_id,
        mobile,
        email,
        date_of_joining,
        role,
        status,
        designation,
        id,
      ];
    } else {
      // If no duplicates are found, proceed with updating the admin record
      sql = `
          UPDATE \`admins\` 
          SET 
            \`name\` = ?, 
            \`emp_id\` = ?, 
            \`mobile\` = ?, 
            \`email\` = ?, 
            \`date_of_joining\` = ?, 
            \`role\` = ?, 
            \`status\` = ?, 
            \`permissions\` = ?,
            \`service_ids\` = ?, 
            \`designation\` = ?
          WHERE \`id\` = ?
        `;

      queryParams = [
        name,
        emp_id,
        mobile,
        email,
        date_of_joining,
        role,
        status,
        permissions,
        service_ids,
        designation,
        id,
      ];
    }
    const resultss = await sequelize.query(sql, {
      replacements: queryParams, // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, resultss); // Successfully updated the admin


  },

  updateMyProfile: async (data, callback) => {
    const {
      name,
      email,
      id,
    } = data;

    const mobile = parseInt(data.mobile, 10);

    // SQL query to check if any field already exists in the admins table
    const checkExistingQuery = `
      SELECT * FROM \`admins\` 
      WHERE (\`email\` = ? OR \`mobile\` = ?) AND \`id\` != ?
    `;
    const results = await sequelize.query(checkExistingQuery, {
      replacements: [email, mobile, id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (results.length > 0) {
      const fieldMapping = {
        email: "email",
        mobile: "mobile",
      };

      const usedFields = [];

      for (const existingAdmin of results) {
        console.log(`existingAdmin - `, existingAdmin);
        for (const [key, label] of Object.entries(fieldMapping)) {
          console.log(`key - `, key);
          console.log(`label - `, label);
          console.log(`existingAdmin[key] - `, existingAdmin[key]);

          if (existingAdmin[key] === eval(key)) {
            usedFields.push(label);
          }
        }
      }

      if (usedFields.length > 0) {
        return callback({
          message:
            `Another admin is registered with the following ${[
              ...new Set(usedFields),
            ].join(" and ")}.`
        },
          null
        );
      }
    }

    const sql = `
            UPDATE \`admins\` 
            SET 
              \`name\` = ?, 
              \`mobile\` = ?, 
              \`email\` = ?
            WHERE \`id\` = ?
          `;

    const queryParams = [
      name,
      mobile,
      email,
      id,
    ];
    const resultss = await sequelize.query(sql, {
      replacements: queryParams, // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    const fetchQuery = `
            SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\`, \`role\`, \`designation\`, \`status\`, \`login_token\`, \`token_expiry\`, \`otp\`, \`two_factor_enabled\`, \`otp_expiry\`, \`date_of_joining\` FROM \`admins\` 
            WHERE \`id\` = ?
          `;

    const fetchs = await sequelize.query(fetchQuery, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, fetchResults[0]);
  },

  delete: async (id, callback) => {
    const sql = `
      DELETE FROM \`admins\`
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.DELETE,
    });
    callback(null, results);
  },

  upload: async (id, savedImagePaths, callback) => {
    const sqlUpdateCustomer = `
      UPDATE admins 
      SET profile_picture = ?
      WHERE id = ?
    `;
    const joinedPaths = savedImagePaths.join(", ");
    // Prepare the parameters for the query
    const queryParams = [joinedPaths, id];
    const results = await sequelize.query(sqlUpdateCustomer, {
      replacements: queryParams, // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });


    const affectedRows = results[1];
    // Check if any rows were affected by the update
    if (affectedRows > 0) {
      return callback(true, { affectedRows }); // Success with results
    } else {
      // No rows updated, return a specific message along with the query details
      return callback(false, {
        error: "No rows updated. Please check the Admin ID.",
        details: results,
        query: sqlUpdateCustomer,
        params: queryParams, // Return the parameters used in the query
      });
    }
  },

  findByEmailOrMobile: async (username, callback) => {
    const sql = `
      SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\`, 
             \`role\`, \`designation\`, \`status\`, \`login_token\`, \`token_expiry\`, 
             \`otp\`, \`two_factor_enabled\`, \`otp_expiry\`, \`date_of_joining\`
      FROM \`admins\`
      WHERE \`email\` = ? OR \`mobile\` = ?
    `;

    const results = await sequelize.query(sql, {
      replacements: [username, username], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (results.length === 0) {
      return callback({ message: "No admin found with the provided email or mobile" }, null);
    }

    callback(null, results);
  },

  findByEmailOrMobileAllInfo: async (username, callback) => {
    const sql = `
      SELECT *
      FROM \`admins\`
      WHERE \`email\` = ? OR \`mobile\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [username, username], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });



    if (results.length === 0) {
      return callback(
        { message: "No admin found with the provided email or mobile" },
        null
      );
    }

    callback(null, results);
  },

  validatePassword: async (username, password, callback) => {
    const sql = `
      SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\`, \`status\`
      FROM \`admins\`
      WHERE (\`email\` = ? OR \`mobile\` = ?)
      AND \`password\` = MD5(?)
    `;
    const results = await sequelize.query(sql, {
      replacements: [username, username, password], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (results.length === 0) {
      return callback(
        { message: "Incorrect password or username" },
        null
      );
    }

    callback(null, results);
  },

  updatePassword: async (new_password, admin_id, callback) => {
    const sql = `UPDATE \`admins\` SET \`password\` = MD5(?), \`reset_password_token\` = null, \`login_token\` = null, \`token_expiry\` = null, \`password_token_expiry\` = null WHERE \`id\` = ?`;


    const results = await sequelize.query(sql, {
      replacements: [new_password, admin_id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });


    if (results.affectedRows === 0) {
      return callback(
        {
          message:
            "Admin not found or password not updated. Please check the provided details.",
        },
        null
      );
    }

    callback(null, {
      message: "Password updated successfully.",
      affectedRows: results.affectedRows,
    });


  },

  updateOTP: async (admin_id, otp, otp_expiry, callback) => {
    const sql = `UPDATE \`admins\` SET \`otp\` = ?, \`otp_expiry\` = ?,  \`reset_password_token\` = null, \`login_token\` = null, \`token_expiry\` = null, \`password_token_expiry\` = null WHERE \`id\` = ?`;
    const results = await sequelize.query(sql, {
      replacements: [otp, otp_expiry, admin_id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });



    // Check if the admin_id was found and the update affected any rows
    if (results.affectedRows === 0) {
      return callback(
        {
          message:
            "Admin not found or password not updated. Please check the provided details.",
        },
        null
      );
    }

    callback(null, {
      message: "Password updated successfully.",
      affectedRows: results.affectedRows,
    });


  },

  updateToken: async (id, token, tokenExpiry, callback) => {
    const sql = `
      UPDATE \`admins\`
      SET \`login_token\` = ?, \`token_expiry\` = ?
      WHERE \`id\` = ?
    `;

    const results = await sequelize.query(sql, {
      replacements: [token, tokenExpiry, id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });

    if (results.affectedRows === 0) {
      return callback(
        {
          message:
            "Token update failed. Admin not found or no changes made.",
        },
        null
      );
    }
    callback(null, results);
  },

  setResetPasswordToken: async (id, token, tokenExpiry, callback) => {
    const sql = `
      UPDATE \`admins\`
      SET \`reset_password_token\` = ?, \`password_token_expiry\` = ?
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [token, tokenExpiry, id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });



    if (results.affectedRows === 0) {
      return callback(
        {
          message:
            "Token update failed. Admin not found or no changes made.",
        },
        null
      );
    }

    callback(null, results);
  },

  validateLogin: async (id, callback) => {
    const sql = `
      SELECT \`login_token\`, \`token_expiry\`
      FROM \`admins\`
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });


    if (results.length === 0) {
      return callback({ message: "Admin not found" }, null);
    }

    callback(null, results);


  },

  // Clear login token and token expiry
  logout: async (id, callback) => {
    const sql = `
        UPDATE \`admins\`
        SET \`login_token\` = NULL, \`token_expiry\` = NULL
        WHERE \`id\` = ?
      `;

    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });


    if (results.affectedRows === 0) {
      return callback(
        {
          message:
            "Token clear failed. Admin not found or no changes made.",
        },
        null
      );
    }

    callback(null, results);


  },

  findById: async (id, callback) => {
    const sql = `
      SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`date_of_joining\`, \`designation\`, \`role\`, \`email\`, \`mobile\`, \`status\`, \`login_token\`, \`token_expiry\`
      FROM \`admins\`
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (results.length === 0) {
      return callback({ message: "Admin not found" }, null);
    }

    callback(null, results[0]);
  },

  fetchAllowedServiceIds: async (id, callback) => {
    const sql = `
        SELECT \`service_ids\`, \`role\` FROM \`admins\`
        WHERE \`id\` = ?
    `;

    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (results.length === 0) {

      return callback({ message: "Admin not found" }, null);
    }
    const { role, service_ids } = results[0];

    if (!["admin", "admin_user"].includes(role)) {
      try {
        // Convert service_ids string to an array and map to numbers
        const serviceIdsArr = service_ids ? service_ids.split(",").map(Number) : [];

        return callback(null, { finalServiceIds: serviceIdsArr });

      } catch (parseErr) {
        console.error("Error parsing service_ids:", parseErr);
        return callback({ message: "Error parsing service_ids data", error: parseErr }, null);
      }
    }

    // If the role is "admin" or "admin_user"
    return callback(null, { finalServiceIds: [] });
  },

  updateCheckInStatus: async (data, callback) => {
    const { checkInStatus, checkInTime, adminId } = data;

    let sqlSelect;
    let updateSql;
    if (checkInStatus === 'check-in') {
      sqlSelect = `
            SELECT * FROM \`admin_login_logs\`
            WHERE DATE(\`created_at\`) = ? AND \`admin_id\` = ? AND \`action\` = 'login' 
            ORDER BY \`created_at\` ASC
            LIMIT 1;
        `;
      updateSql = `
            UPDATE \`admin_login_logs\`
            SET \`check_in_status\` = 1, \`check_in_time\` = ?
            WHERE \`id\` = ?;
        `;
    } else if (checkInStatus === 'check-out') {
      sqlSelect = `
            SELECT * FROM \`admin_login_logs\`
            WHERE DATE(\`created_at\`) = ? AND \`admin_id\` = ? AND \`action\` = 'login'
            ORDER BY \`created_at\` ASC
            LIMIT 1;
        `;
      updateSql = `
            UPDATE \`admin_login_logs\`
            SET \`check_out_status\` = 1, \`check_out_time\` = ?
            WHERE \`id\` = ?;
        `;
    } else {
      return callback({ message: "Invalid checkInStatus" }, null);
    }

    try {
      // Ensure checkInTime is a string with the format YYYY-MM-DD (if it's a Date object, convert it)
      const formattedCheckInTime = new Date(checkInTime).toISOString().split('T')[0]; // Extracts the date part

      console.log('Formatted Check-in Time:', formattedCheckInTime); // Debug log to check the formatted date
      console.log('Admin ID:', adminId); // Debug log to check the adminId

      // Execute the query to get results
      const results = await sequelize.query(sqlSelect, {
        replacements: [formattedCheckInTime, adminId], // Pass the formatted checkInTime to match the date part
        type: QueryTypes.SELECT,
      });

      // Check if results are found
      if (results.length === 0) {
        console.log('No results found for the given date and adminId.');
        return callback({ message: "No Login Log Found. Please login first." }, null);
      }

      // Check if already checked in or checked out based on the status
      const existingLog = results[0];
      if (checkInStatus === 'check-in' && existingLog.check_in_status === 1) {
        console.log('Admin already checked in.');
        return callback({ message: "Admin already checked in." }, null);
      } else if (checkInStatus === 'check-out' && existingLog.check_out_status === 1) {
        console.log('Admin already checked out.');
        return callback({ message: "Admin already checked out." }, null);
      }

      console.log(`Results found:`, results.length);

      // Execute the update query
      await sequelize.query(updateSql, {
        replacements: [checkInTime, existingLog.id], // Update the first record found
        type: QueryTypes.UPDATE,
      });

      // Successful update
      callback(null, { message: "Check-in status updated successfully." });

    } catch (error) {
      // Catch any SQL or Sequelize-related errors
      console.error('Error during admin check-in:', error);
      callback(error, null);
    }
  }
};

module.exports = Admin;
