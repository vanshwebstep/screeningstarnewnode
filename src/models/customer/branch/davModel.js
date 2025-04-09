const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../../config/db");

const dav = {
  getDAVApplicationById:async  (candidate_application_id, callback) => {
      const sql =
        "SELECT * FROM `dav_applications` WHERE `candidate_application_id` = ?";
        const results = await sequelize.query(sql, {
          replacements: [candidate_application_id], // Positional replacements using ?
          type: QueryTypes.SELECT,
        });
        callback(null, results[0]);
   
 
  },

  create: async (
    personal_information,
    candidate_application_id,
    branch_id,
    customer_id,
    callback
  ) => {
    const fields = Object.keys(personal_information).map((field) =>
      field.toLowerCase()
    );
      // 1. Check for existing columns in dav_applications
      const checkColumnsSql = `SHOW COLUMNS FROM \`dav_applications\``;
      const results = await sequelize.query(checkColumnsSql, {
        replacements: [fields], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
        const existingColumns = results.map((row) => row.Field);
        const missingColumns = fields.filter(
          (field) => !existingColumns.includes(field)
        );

        // 2. If there are missing columns, alter the table to add them
        if (missingColumns.length > 0) {
          const alterQueries = missingColumns.map((column) => {
            return `ALTER TABLE dav_applications ADD COLUMN \`${column}\` LONGTEXT`; // Adjust data type as necessary
          });

          // Run all ALTER statements
          const alterPromises = alterQueries.map(
            (query) =>
              new Promise(async (resolve, reject) => {
               await sequelize.query(query, {
                  type: QueryTypes.RAW,
                });
                  resolve();
              })
          );

          // After altering the table, proceed to insert or update the data
          Promise.all(alterPromises)
            .then(() => {
              // Insert or update entry after table alteration
              dav.insertOrUpdateEntry(
                connection,
                personal_information,
                candidate_application_id,
                branch_id,
                customer_id,
                callback
              );
            })
            .catch((alterErr) => {
              console.error("Error executing ALTER statements:", alterErr);
              
              callback(alterErr, null);
            });
        } else {
          // If no columns are missing, proceed to check and insert or update the entry
          dav.insertOrUpdateEntry(
            connection,
            personal_information,
            candidate_application_id,
            branch_id,
            customer_id,
            callback
          );
        }
     
  
  },

  // Helper function for inserting or updating the entry
  insertOrUpdateEntry: async (
    connection,
    personal_information,
    candidate_application_id,
    branch_id,
    customer_id,
    callback
  ) => {
    // Check if entry exists by candidate_application_id
    const checkEntrySql =
      "SELECT * FROM dav_applications WHERE candidate_application_id = ?";
      const entryResults = await sequelize.query(checkEntrySql, {
        replacements: [candidate_application_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
        if (entryResults.length > 0) {
          // Entry exists, so update it
          personal_information.branch_id = branch_id;
          personal_information.customer_id = customer_id;

          const updateSql =
            "UPDATE dav_applications SET ? WHERE candidate_application_id = ?";
            const updateResult = await sequelize.query(updateSql, {
              replacements: [personal_information, candidate_application_id], // Positional replacements using ?
              type: QueryTypes.UPDATE,
            });
              callback(null, updateResult);
          
        } else {
          // Entry does not exist, so insert it
          const insertSql = "INSERT INTO dav_applications SET ?";
          const insertResult = await sequelize.query(insertSql, {
            replacements: {
              ...personal_information,
              candidate_application_id,
              branch_id,
              customer_id,
            }, // Positional replacements using ?
            type: QueryTypes.INSERT,
          });
              callback(null, insertResult);
        }
  },

  updateImages: async (
    dav_id,
    candidate_application_id,
    imagesArr,
    dbColumn,
    callback
  ) => {
    // Check if `imagesArr` is an array
    let images;
    if (Array.isArray(imagesArr)) {
      if (imagesArr.length === 0) {
        console.error("Images array is empty.");
        return callback(new Error("Images array cannot be empty."), null);
      }
      // Convert images array into a comma-separated string
      images = imagesArr.join(",");
    } else {
      // If `imagesArr` is not an array, use it as-is
      images = imagesArr;
    }

    // Define the SQL query with placeholders
    const sql = `
      UPDATE \`dav_applications\`
      SET \`${dbColumn}\` = ?
      WHERE \`id\` = ? AND \`candidate_application_id\` = ?
    `;

    // Start a database connection
     
      // First, check if the column exists in the table
      const checkColumnSql = `SHOW COLUMNS FROM \`dav_applications\``;
      const checkResults = await sequelize.query(checkColumnSql, {
        type: QueryTypes.SELECT,
      });
        
        const existingColumns = checkResults.map((row) => row.Field);

        // If the column doesn't exist, alter the table
        if (!existingColumns.includes(dbColumn)) {
          const alterTableSql = `
      ALTER TABLE \`dav_applications\`
      ADD COLUMN \`${dbColumn}\` LONGTEXT
    `;
   await sequelize.query(alterTableSql, {
      replacements: [username], // Positional replacements using ?
      type: QueryTypes.RAW,
    });
    const results = await sequelize.query(sql, {
      replacements: [images, dav_id, candidate_application_id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
                callback(null, results); // Return the results
            
        
        } else {
          const results = await sequelize.query(sql, {
            replacements: [images, dav_id, candidate_application_id], // Positional replacements using ?
            type: QueryTypes.UPDATE,
          });
              callback(null, results);
      
        }
  },
};

module.exports = dav;
