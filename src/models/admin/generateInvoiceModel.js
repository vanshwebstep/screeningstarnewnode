const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const crypto = require("crypto"); // required for hashPassword

// Function to hash the password using MD5
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

const generateInvoiceModel = {
  generateInvoice: async (customerId, month, year, callback) => {
    console.log("🔄 Start generating invoice");

    const customerQuery = `...`; // same query
    console.log("📡 Fetching customer details...");
    const customerResults = await sequelize.query(customerQuery, {
      replacements: [customerId],
      type: QueryTypes.SELECT,
    });

    if (customerResults.length === 0) {
      console.warn("❌ Customer not found.");
      return callback(new Error("Customer not found."), null);
    }

    const customerData = customerResults[0];
    console.log("✅ Customer details retrieved:", customerData.name);

    let servicesData;
    try {
      servicesData = JSON.parse(customerData.services);
      console.log("🛠️ Parsed services data successfully");
    } catch (parseError) {
      console.error("❌ Failed to parse services JSON:", parseError);
      return callback(parseError, null);
    }

    const updateServiceTitles = async () => {
      try {
        console.log("🔍 Updating service titles...");
        for (const group of servicesData) {
          for (const service of group.services) {
            const serviceSql = `SELECT title FROM services WHERE id = ?`;
            const [rows] = await new Promise(async (resolve) => {
              const results = await sequelize.query(serviceSql, {
                replacements: [service.serviceId],
                type: QueryTypes.SELECT,
              });
              resolve(results);
            });
            if (rows && rows.title) {
              console.log(`📌 Service ID ${service.serviceId} -> Title: ${rows.title}`);
              service.serviceTitle = rows.title;
            }
          }
        }
      } catch (err) {
        console.error("❌ Error updating service titles:", err);
      } finally {
        customerData.services = JSON.stringify(servicesData);
        console.log("📦 Fetching completed/closed applications for customer...");

        const applicationQuery = `...`; // same query
        const applicationResults = await sequelize.query(applicationQuery, {
          replacements: [customerId, month, year],
          type: QueryTypes.SELECT,
        });

        console.log(`📋 Total applications fetched: ${applicationResults.length}`);

        const branchApplicationsMap = {};
        applicationResults.forEach((application) => {
          const branchId = application.branch_id;
          if (!branchApplicationsMap[branchId]) {
            branchApplicationsMap[branchId] = {
              id: branchId,
              applications: [],
            };
          }
          application.statusDetails = application.statusDetails || [];
          branchApplicationsMap[branchId].applications.push(application);
        });

        const branchesWithApplications = [];
        const branchIds = Object.keys(branchApplicationsMap);

        console.log("🏢 Fetching branch names...");
        const branchPromises = branchIds.map((branchId) => {
          return new Promise(async (resolve, reject) => {
            const branchQuery = `SELECT id, name FROM branches WHERE id = ?;`;
            const branchResults = await sequelize.query(branchQuery, {
              replacements: [branchId],
              type: QueryTypes.SELECT,
            });

            if (branchResults.length > 0) {
              const branch = branchResults[0];
              branchesWithApplications.push({
                id: branch.id,
                name: branch.name,
                applications: branchApplicationsMap[branchId].applications,
              });
              console.log(`✅ Branch found: ${branch.name} (ID: ${branch.id})`);
            } else {
              console.warn(`⚠️ Branch not found for ID: ${branchId}`);
            }
            resolve();
          });
        });

        const applicationServicePromises = applicationResults.map((application) => {
          const services = application.services.split(",");
          const servicePromises = services.map((serviceId) => {
            return new Promise(async (resolve, reject) => {
              const reportFormQuery = `SELECT json FROM report_forms WHERE service_id = ?;`;
              const reportFormResults = await sequelize.query(reportFormQuery, {
                replacements: [serviceId],
                type: QueryTypes.SELECT,
              });

              if (reportFormResults.length > 0) {
                const reportFormJson = JSON.parse(reportFormResults[0].json);
                const dbTable = reportFormJson.db_table;
                console.log(`🔧 Processing service ${serviceId} in table: ${dbTable}`);

                const additionalFeeColumnQuery = `SHOW COLUMNS FROM \`${dbTable}\` WHERE \`Field\` LIKE 'additional_fee%'`;
                const columnResults = await sequelize.query(additionalFeeColumnQuery, {
                  type: QueryTypes.SHOW,
                });

                const additionalFeeColumn =
                  columnResults.length > 0 ? columnResults[0].Field : null;

                const statusQuery = `
                  SELECT status${additionalFeeColumn ? `, ${additionalFeeColumn}` : ""}
                  FROM ${dbTable}
                  WHERE client_application_id = ?;
                `;

                const statusResults = await sequelize.query(statusQuery, {
                  replacements: [application.id],
                  type: QueryTypes.SELECT,
                });

                console.log(`📊 Status fetched for application ${application.id}`);

                application.statusDetails.push({
                  serviceId,
                  status: statusResults.length > 0 ? statusResults[0].status : null,
                  additionalFee:
                    additionalFeeColumn && statusResults.length > 0
                      ? statusResults[0][additionalFeeColumn]
                      : null,
                });
                resolve();
              } else {
                console.warn(`❌ No report form found for service ID: ${serviceId}`);
                resolve();
              }
            });
          });

          return Promise.all(servicePromises);
        });

        Promise.all(applicationServicePromises)
          .then(() => Promise.all(branchPromises))
          .then(() => {
            const finalResults = {
              customerInfo: customerData,
              applicationsByBranch: branchesWithApplications,
            };
            console.log("✅ Final result compiled successfully.");
            callback(null, finalResults);
          })
          .catch((err) => {
            console.error("❌ Error during data aggregation:", err);
            callback(err, null);
          });
      }
    };

    updateServiceTitles();
  },
};

module.exports = generateInvoiceModel;
