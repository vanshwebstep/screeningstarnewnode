const ClientMasterTrackerModel = require("../models/admin/clientMasterTrackerModel");
const { jsPDF } = require("jspdf");
require("jspdf-autotable");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
const {
  upload,
  saveImage,
  saveImages,
  savePdf,
} = require("../utils/cloudImageSave");

const getImageFormat = (url) => {
  const ext = url.split(".").pop().toLowerCase();
  if (ext === "png") return "PNG";
  if (ext === "jpg" || ext === "jpeg") return "JPEG";
  if (ext === "webp") return "WEBP";
  return "PNG"; // Default to PNG if not recognized
};

async function checkImageExists(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok; // Returns true if HTTP status is 200-299
  } catch (error) {
    console.error(`Error checking image existence at ${url}:`, error);
    return false;
  }
}

async function validateImage(url) {
  try {
    // Use axios to fetch the image as a binary buffer
    const response = await axios.get(url, { responseType: "arraybuffer" });
    // Check if the image was fetched successfully
    if (response.status !== 200) {
      console.warn(
        `Image fetch failed for URL: ${url} with status: ${response.status}`
      );
      return null;
    }

    // Check if the response data is valid
    if (!response.data) {
      console.warn(`No data found in the response for URL: ${url}`);
      return null;
    }

    // Convert the response data to a Buffer
    const buffer = Buffer.from(response.data);

    // Use sharp to extract image metadata
    const metadata = await sharp(buffer).metadata();

    // If the metadata is invalid or not retrieved, return null
    if (!metadata) {
      console.warn(`Unable to fetch metadata for image from URL: ${url}`);
      return null;
    }
    // Return the image URL, width, and height in an array
    return { src: url, width: metadata.width, height: metadata.height };
  } catch (error) {
    console.error(`Error validating image from ${url}:`, error);
    return null;
  }
}

async function fetchImageAsBase64(imageUrl) {
  try {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    return `data:image/png;base64,${Buffer.from(
      response.data,
      "binary"
    ).toString("base64")}`;
  } catch (error) {
    console.error("Error fetching or converting image:", error.message);
    throw new Error("Failed to fetch image");
  }
}

function addFooter(doc) {
  // Define the height of the footer and its position
  const footerHeight = 15; // Footer height
  const pageHeight = doc.internal.pageSize.height; // Get the total page height
  const footerYPosition = pageHeight - footerHeight + 10; // Position footer closer to the bottom

  // Define page width and margins
  const pageWidth = doc.internal.pageSize.width;
  const margin = 10; // Margins on the left and right

  // Space between sections (adjust dynamically based on page width)
  const availableWidth = pageWidth - 2 * margin; // Usable width excluding margins
  const centerX = pageWidth / 2; // Center of the page

  // Insert text into the center column (centered)
  const footerText =
    "Plot No. 19/4 2, IndiQube Alpha, 1st Floor, Outer Ring Road, Panathur Junction, Kadubeesanahalli, Marathahalli, Bangalore-560103 | www.screeningstar.com";
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0); // Set text color to black (RGB: 0, 0, 0)
  doc.setFontSize(7);
  doc.text(footerText, centerX, footerYPosition - 3, { align: "center" }); // Adjusted vertical position

  // Insert page number into the right column (right-aligned)
  const pageCount = doc.internal.getNumberOfPages(); // Get total number of pages
  const currentPage = doc.internal.getCurrentPageInfo().pageNumber; // Get current page number
  const pageNumberText = `Page ${currentPage} / ${pageCount}`;
  const pageNumberWidth = doc.getTextWidth(pageNumberText); // Calculate text width

  // Right-align page number with respect to the page width
  const pageNumberX = pageWidth - margin - pageNumberWidth;
  doc.text(pageNumberText, pageNumberX, footerYPosition - 3); // Adjusted vertical position

  // Draw a line above the footer
  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0); // Set line color to black (RGB: 0, 0, 0)
  doc.line(
    margin,
    footerYPosition - 7,
    pageWidth - margin,
    footerYPosition - 7
  ); // Line above the footer
}
function scaleImage(img, maxWidth, maxHeight) {
  const imgWidth = img.width;
  const imgHeight = img.height;

  let width = imgWidth;
  let height = imgHeight;

  // Scale image to fit within maxWidth and maxHeight
  if (imgWidth > maxWidth) {
    width = maxWidth;
    height = (imgHeight * maxWidth) / imgWidth;
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = (imgWidth * maxHeight) / imgHeight;
  }

  return { width, height };
}

async function addImageToPDF(
  doc,
  imageUrl,
  imageFormat,
  centerXImage,
  yPosition
) {
  const img = await validateImage(imageUrl);

  if (img) {
    try {
      // Check if the image format is correct (PNG, JPEG, etc.)
      if (img.src && imageFormat) {
        doc.addImage(
          img.src,
          imageFormat,
          centerXImage,
          yPosition,
          img.width,
          img.height
        );
      }
    } catch (error) {
      console.error(`Failed to add image to PDF: ${imageUrl}`, error);
    }
  } else {
    console.warn(`Image validation failed for ${imageUrl}`);
  }
}

// Function to format the date to "Month Day, Year" format
const formatDate = (date) => {
  const dateObj = new Date(date);
  const options = { year: "numeric", month: "long", day: "numeric" };
  return dateObj.toLocaleDateString("en-US", options); // This gives "November 30, 1899"
};

function formatStatus(status) {
  // Step 1: Replace all special characters with a space
  let formatted = status.replace(/[^a-zA-Z0-9 ]/g, " ");

  // Step 2: Trim extra spaces from start and end, and then split into words
  formatted = formatted.trim().replace(/\s+/g, " ");

  // Step 3: Capitalize based on length
  if (formatted.length < 6) {
    // Capitalize the whole string
    return formatted.toUpperCase();
  } else {
    // Capitalize only the first letter of each word
    return formatted.replace(/\b\w/g, function (char) {
      return char.toUpperCase();
    });
  }
}

module.exports = {
  generatePDF: async (
    client_applicaton_id,
    branch_id,
    pdfFileName,
    targetDirectory
  ) => {
    return new Promise((resolve, reject) => {
      // Fetch application data
      ClientMasterTrackerModel.applicationByID(
        client_applicaton_id,
        branch_id,
        async (err, application) => {
          if (err) {
            console.error("Database error:", err);
            return reject(new Error(`Database error: ${err.message}`));
          }

          if (!application) {
            return reject(new Error("Application not found"));
          }

          // Fetch CMT Application Data
          ClientMasterTrackerModel.getCMTApplicationById(
            client_applicaton_id,
            async (err, CMTApplicationData) => {
              if (err) {
                console.error("Database error:", err);
                return reject(new Error(`Database error: ${err.message}`));
              }
              // Split service_id into an array
              const serviceIds = application.services
                .split(",")
                .map((id) => id.trim());
              const annexureResults = [];
              let pendingRequests = serviceIds.length;

              if (pendingRequests === 0) {
                reject(new Error("No service IDs to process."));
              }

              serviceIds.forEach((id) => {
                ClientMasterTrackerModel.reportFormJsonByServiceID(
                  id,
                  (err, reportFormJson) => {
                    if (err) {
                      console.error(
                        `Error fetching report form JSON for service ID ${id}:`,
                        err
                      );
                      annexureResults.push({
                        service_id: id,
                        serviceStatus: false,
                        message: err.message,
                      });
                      finalizeRequest();
                      return;
                    }

                    if (!reportFormJson) {
                      console.warn(
                        `Report form JSON not found for service ID ${id}`
                      );
                      annexureResults.push({
                        service_id: id,
                        serviceStatus: false,
                        message: "Report form JSON not found",
                      });
                      finalizeRequest();
                      return;
                    }

                    const parsedData = JSON.parse(reportFormJson.json);
                    const db_table = parsedData.db_table.replace(/-/g, "_"); // Modify table name
                    const heading = parsedData.heading;

                    ClientMasterTrackerModel.annexureData(
                      client_applicaton_id,
                      db_table,
                      (err, annexureData) => {
                        if (err) {
                          console.error(
                            `Error fetching annexure data for service ID ${id}:`,
                            err
                          );
                          annexureResults.push({
                            service_id: id,
                            annexureStatus: false,
                            annexureData: null,
                            serviceStatus: true,
                            reportFormJson,
                            message:
                              "An error occurred while fetching annexure data.",
                            error: err,
                          });
                        } else if (!annexureData) {
                          console.warn(
                            `Annexure data not found for service ID ${id}`
                          );
                          annexureResults.push({
                            service_id: id,
                            annexureStatus: false,
                            annexureData: null,
                            serviceStatus: true,
                            reportFormJson,
                            message: "Annexure Data not found.",
                          });
                        } else {
                          annexureResults.push({
                            service_id: id,
                            annexureStatus: true,
                            serviceStatus: true,
                            reportFormJson,
                            annexureData,
                            heading,
                          });
                        }
                        finalizeRequest();
                      }
                    );
                  }
                );
              });

              async function finalizeRequest() {
                pendingRequests -= 1;
                if (pendingRequests === 0) {
                  // Define the directory where the PDF will be saved
                  const directoryPath = path.join(targetDirectory);
                  const pdfPath = path.join(directoryPath, pdfFileName);

                  // Check if directory exists, and create it if not
                  if (!fs.existsSync(directoryPath)) {
                    fs.mkdirSync(directoryPath, { recursive: true });
                  }
                  try {
                    const filteredResults = annexureResults.filter(
                      (item) => item != null
                    );
                    const servicesData = filteredResults;
                    const doc = new jsPDF();
                    const pageWidth = doc.internal.pageSize.getWidth();
                    let yPosition = 10;

                    const sideMargin = 10;

                    const mainTitle = "BACKGROUND VERIFICATION REPORT";

                    doc.addImage(
                      "data:image/png;base64,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",
                      "PNG",
                      10,
                      10,
                      50,
                      20
                    );

                    doc.setFont("helvetica");
                    doc.setFontSize(12);
                    doc.text("Screeningstar Solutions Pvt Ltd", 10, 35);
                    doc.setFont("helvetica", "normal");
                    doc.text("No 93/9, Varthur Main Road", 10, 40);
                    doc.text("Marathahalli, Bangalore, Karnataka,", 10, 45);
                    doc.text("India, Pin Code - 560037", 10, 50);

                    const imgBoxX = pageWidth - 40;
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(10);
                    doc.text(application.name || "", imgBoxX + 15, 20, {
                      align: "center",
                    });
                    doc.rect(imgBoxX, 23, 30, 23);
                    doc.text(application.name || "", imgBoxX + 15, 50, {
                      align: "center",
                    });

                    doc.setLineWidth(1);
                    doc.line(10, 55, pageWidth - 10, 55);

                    const titleWidth = pageWidth - 2 * sideMargin; // Adjust width for equal margins
                    const titleHeight = 8; // Height of the rectangle
                    const titleY = 60; // Y position of the rectangle

                    // Draw background rectangle
                    doc.setFillColor(246, 246, 246);
                    doc.rect(sideMargin, titleY, titleWidth, titleHeight, "F"); // Centered background rectangle with equal side gaps

                    // Draw border rectangle
                    doc.setDrawColor(62, 118, 165);
                    doc.setLineWidth(0.3);
                    doc.rect(sideMargin, titleY, titleWidth, titleHeight); // Centered border rectangle with equal side gaps

                    // Set font and size for the title
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(10);

                    // Calculate text height to align it vertically in the rectangle
                    const textHeight = doc.getTextDimensions(mainTitle).h;
                    const verticalCenter =
                      titleY + titleHeight / 2 + textHeight / 4; // Center text vertically

                    // Add text centered horizontally and vertically
                    doc.text(mainTitle, pageWidth / 2, verticalCenter, {
                      align: "center",
                    });

                    addFooter(doc);
                    const headerTableData = [
                      [
                        "SCREENINGSTAR REF ID",
                        application.application_id,
                        "DATE OF BIRTH",
                        formatDate(CMTApplicationData.dob) || "N/A",
                      ],
                      [
                        "EMPLOYEE ID",
                        application.employee_id || "N/A",
                        "INSUFF CLEARED",
                        formatDate(
                          CMTApplicationData.first_insuff_reopened_date
                        ) || "N/A",
                      ],
                      [
                        "VERIFICATION INITIATED",
                        CMTApplicationData.verification_initiated || "N/A",
                        "FINAL REPORT DATE",
                        formatDate(CMTApplicationData.report_date) || "N/A",
                      ],
                      [
                        "VERIFICATION PURPOSE",
                        CMTApplicationData.verification_purpose || "Employment",
                        "VERIFICATION STATUS",
                        CMTApplicationData.final_verification_status || "N/A",
                      ],
                      [
                        "REPORT TYPE",
                        CMTApplicationData.report_type || "Employment",
                        "REPORT STATUS",
                        CMTApplicationData.report_status || "N/A",
                      ],
                    ];

                    doc.autoTable({
                      body: headerTableData,
                      startY: 70,
                      styles: {
                        fontSize: 10,
                        cellPadding: 2,
                        textColor: [0, 0, 0],
                        lineWidth: 0.5, // Set the width of the border
                        lineColor: [62, 118, 165], // Set the color of the border (black in this case)
                      },
                      columnStyles: {
                        0: { fontStyle: "bold" },
                        2: { fontStyle: "bold" },
                      },
                      theme: "grid", // 'grid' theme already applies cell borders
                      headStyles: {
                        fillColor: [62, 118, 165],
                        textColor: [255, 255, 255],
                        fontStyle: "bold",
                      },
                      tableLineColor: [62, 118, 165],
                      tableLineWidth: 0.5,
                      margin: {
                        left: sideMargin,
                        right: sideMargin,
                        bottom: 20,
                      },
                    });
                    addFooter(doc);

                    addFooter(doc);

                    const SummaryTitle =
                      "SUMMARY OF THE VERIFICATION CONDUCTED";
                    const backgroundColor = "#f5f5f5";
                    const borderColor = "#3d75a6";
                    const xsPosition = 10;
                    const ysPosition = 120;
                    const fullWidth = pageWidth - 20;
                    const rectHeight = 10;

                    // Set background color and border for the rectangle
                    doc.setFillColor(backgroundColor);
                    doc.setDrawColor(62, 118, 165);
                    doc.rect(
                      xsPosition,
                      ysPosition,
                      fullWidth,
                      rectHeight,
                      "FD"
                    );

                    // Set font to bold and size
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(10);

                    // Calculate the vertical center of the rectangle (center of the rectangle)
                    const verticalCenterY = ysPosition + rectHeight / 2;

                    // Calculate the horizontal center of the page (center of the page)
                    const horizontalCenterX = pageWidth / 2;

                    // Add text with proper centering
                    doc.text(SummaryTitle, horizontalCenterX, verticalCenterY, {
                      align: "center",
                      baseline: "middle",
                    });

                    // Add footer
                    addFooter(doc);

                    const marginTop = 5;
                    const nextContentYPosition =
                      ysPosition + rectHeight + marginTop;

                    doc.autoTable({
                      head: [
                        [
                          {
                            content: "SCOPE OF SERVICES / COMPONENT",
                            styles: {
                              halign: "center",
                              valign: "middle",
                              fontStyle: "bold",
                              whiteSpace: "nowrap", // Ensure header text doesn't wrap
                              cellWidth: "auto", // Allow the header to dynamically adjust width
                            },
                          },
                          {
                            content: "INFORMATION VERIFIED BY",
                            styles: {
                              halign: "center",
                              valign: "middle",
                              fontStyle: "bold",
                              whiteSpace: "nowrap", // Ensure header text doesn't wrap
                              cellWidth: "auto", // Allow the header to dynamically adjust width
                            },
                          },
                          {
                            content: "VERIFIED DATE",
                            styles: {
                              halign: "center",
                              valign: "middle",
                              fontStyle: "bold",
                              whiteSpace: "nowrap", // Ensure header text doesn't wrap
                              cellWidth: "auto", // Allow the header to dynamically adjust width
                            },
                          },
                          {
                            content: "VERIFICATION STATUS",
                            styles: {
                              halign: "center",
                              valign: "middle",
                              fontStyle: "bold",
                              whiteSpace: "nowrap", // Ensure header text doesn't wrap
                              cellWidth: "auto", // Allow the header to dynamically adjust width
                            },
                          },
                        ],
                      ],
                      body: servicesData.map((service) => {
                        const colorMapping = {
                          Yellow: "yellow",
                          Red: "red",
                          Blue: "blue",
                          Green: "green",
                          Orange: "orange",
                          Pink: "pink",
                          // Add more colors as needed
                        };
                        const notstatusContent = service?.annexureData?.status ?? "Not Verified";
                        const statusContent = notstatusContent
                          .replace(/_/g, " ") // Replaces underscores with spaces
                          .replace(/[^a-zA-Z0-9 ]/g, "") // Removes special characters
                          .replace(/\b\w/g, (char) => char.toUpperCase());
                        let textColorr = "black";
                        for (let color in colorMapping) {
                          if (statusContent.includes(color)) {
                            textColorr = colorMapping[color];
                          }
                        }
                        return [
                          {
                            content: service.reportFormJson?.json
                              ? JSON.parse(service.reportFormJson.json)?.heading || "N/A"
                              : "N/A",
                            styles: { fontStyle: "bold" },
                          },
                          {
                            content:
                              service.annexureData[
                              Object.keys(service.annexureData).find((key) =>
                                key.endsWith("info_source")
                              )
                              ] || "N/A",
                            styles: { fontStyle: "bold" }, // Bold content for the cell
                          },
                          {
                            content: service.annexureData.created_at
                              ? new Date(
                                service.annexureData.created_at
                              ).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                              : "N/A", // Format date as "12 Jan 2024" or "N/A" if missing
                            styles: { fontStyle: "bold" }, // Bold content for the cell
                          },
                          {
                            content: formatStatus(statusContent),
                            styles: {
                              fontStyle: "bold",
                              textColor: textColorr, // Apply the color based on the presence of a color name in the status
                            },
                          },
                        ];
                      }),
                      startY: nextContentYPosition,
                      styles: {
                        fontSize: 8,
                        cellPadding: 2,
                        halign: "center",
                        valign: "middle",
                        lineWidth: 0.5,
                        lineColor: [62, 118, 165],
                        textColor: [0, 0, 0], // This will set the text color to black for body cells
                      },
                      theme: "grid",
                      headStyles: {
                        fillColor: backgroundColor,
                        textColor: [0, 0, 0],
                        fontStyle: "bold",
                        halign: "center", // Centering the text in header
                        valign: "middle", // Vertical alignment of header text
                      },
                      tableLineColor: [62, 118, 165],
                      tableLineWidth: 0.5,
                      textColor: [0, 0, 0],
                      margin: { left: 10, right: 10 },
                      tableWidth: "auto",
                      columnStyles: {
                        0: { cellWidth: "auto", halign: "center" }, // Align content to center
                        1: { cellWidth: "auto", halign: "center" }, // Align content to center
                        2: { cellWidth: "auto", halign: "center" }, // Align content to center
                        3: { cellWidth: "auto", halign: "center" }, // Align content to center
                      },
                    });

                    addFooter(doc);

                    doc.autoTable({
                      head: [
                        [
                          {
                            content: "COLOR CODE / ADJUDICATION MATRIX",
                            colSpan: 5,
                            styles: {
                              halign: "center",
                              fontSize: 10,
                              fontStyle: "bold",
                              fillColor: [246, 246, 246],
                              whiteSpace: "nowrap", // Prevent wrapping of header text
                              maxWidth: 200, // Limit max width for the heading
                              overflow: "ellipsis", // Optional: Add ellipsis if the content exceeds max width
                            },
                          },
                        ],
                        [
                          {
                            content: "MAJOR DISCREPANCY",
                            styles: {
                              halign: "center",
                              fontStyle: "bold",
                              whiteSpace: "nowrap", // Prevent text wrapping
                              maxWidth: 50, // Control width of the header cell
                              overflow: "ellipsis", // Optional: Add ellipsis if text exceeds width
                            },
                          },
                          {
                            content: "MINOR DISCREPANCY",
                            styles: {
                              halign: "center",
                              fontStyle: "bold",
                              whiteSpace: "nowrap", // Prevent text wrapping
                              maxWidth: 50, // Control width of the header cell
                              overflow: "ellipsis", // Optional: Add ellipsis if text exceeds width
                            },
                          },
                          {
                            content: "UNABLE TO VERIFY",
                            styles: {
                              halign: "center",
                              fontStyle: "bold",
                              whiteSpace: "nowrap", // Prevent text wrapping
                              maxWidth: 50, // Control width of the header cell
                              overflow: "ellipsis", // Optional: Add ellipsis if text exceeds width
                            },
                          },
                          {
                            content: "PENDING FROM SOURCE",
                            styles: {
                              halign: "center",
                              fontStyle: "bold",
                              whiteSpace: "nowrap", // Prevent text wrapping
                              maxWidth: 50, // Control width of the header cell
                              overflow: "ellipsis", // Optional: Add ellipsis if text exceeds width
                            },
                          },
                          {
                            content: "ALL CLEAR",
                            styles: {
                              halign: "center",
                              fontStyle: "bold",
                              whiteSpace: "nowrap", // Prevent text wrapping
                              maxWidth: 50, // Control width of the header cell
                              overflow: "ellipsis", // Optional: Add ellipsis if text exceeds width
                            },
                          },
                        ],
                      ],
                      body: [
                        [
                          {
                            content: "",
                            styles: {
                              cellPadding: 5,
                              cellHeight: 15,
                              halign: "center",
                              valign: "middle",
                            },
                          },
                          {
                            content: "",
                            styles: {
                              cellPadding: 5,
                              cellHeight: 15,
                              halign: "center",
                              valign: "middle",
                            },
                          },
                          {
                            content: "",
                            styles: {
                              cellPadding: 5,
                              cellHeight: 15,
                              halign: "center",
                              valign: "middle",
                            },
                          },
                          {
                            content: "",
                            styles: {
                              cellPadding: 5,
                              cellHeight: 15,
                              halign: "center",
                              valign: "middle",
                            },
                          },
                          {
                            content: "",
                            styles: {
                              cellPadding: 5,
                              cellHeight: 15,
                              halign: "center",
                              valign: "middle",
                            },
                          },
                        ],
                      ],
                      startY: doc.previousAutoTable
                        ? doc.previousAutoTable.finalY + 10
                        : 10,
                      styles: {
                        fontSize: 8,
                        cellPadding: 2,
                        halign: "center",
                        valign: "middle",
                        lineWidth: 0.5,
                        lineColor: [62, 118, 165],
                      },
                      theme: "grid",
                      headStyles: {
                        fillColor: [246, 246, 246],
                        textColor: [0, 0, 0],
                        fontStyle: "bold",
                        whiteSpace: "nowrap", // Prevent text wrapping in header
                        halign: "center", // Center the header text
                        maxWidth: 200, // Control width of the header cell
                      },
                      tableLineColor: [62, 118, 165],
                      tableLineWidth: 0.5,
                      margin: { left: 10, right: 10 },
                      tableWidth: "auto",
                      columnStyles: {
                        0: { cellWidth: 38, cellMargin: 5 },
                        1: { cellWidth: 38, cellMargin: 5 },
                        2: { cellWidth: 38, cellMargin: 5 },
                        3: { cellWidth: 38, cellMargin: 5 },
                        4: { cellWidth: 38, cellMargin: 5 },
                      },
                      didDrawCell: function (data) {
                        const boxWidth = 25; // Inner box width
                        const boxHeight = 8; // Inner box height
                        const cellX =
                          data.cell.x + (data.cell.width - boxWidth) / 2; // Center box horizontally
                        const cellY =
                          data.cell.y + (data.cell.height - boxHeight) / 2; // Center box vertically

                        // Convert the cell text to a string and trim any spaces
                        let cellText = data.cell.text;
                        if (Array.isArray(cellText)) {
                          cellText = cellText.join(""); // Join array elements if the text is an array
                        }

                        if (data.row.index === 0) {
                          if (cellText.trim() === "") {
                            // Check for empty or whitespace
                            switch (data.column.index) {
                              case 0:
                                doc.setFillColor(255, 0, 0); // Red
                                doc.rect(
                                  cellX,
                                  cellY,
                                  boxWidth,
                                  boxHeight,
                                  "F"
                                );
                                break;
                              case 1:
                                doc.setFillColor(255, 255, 0); // Yellow
                                doc.rect(
                                  cellX,
                                  cellY,
                                  boxWidth,
                                  boxHeight,
                                  "F"
                                );
                                break;
                              case 2:
                                doc.setFillColor(255, 165, 0); // Orange
                                doc.rect(
                                  cellX,
                                  cellY,
                                  boxWidth,
                                  boxHeight,
                                  "F"
                                );
                                break;
                              case 3:
                                doc.setFillColor(255, 192, 203); // Pink
                                doc.rect(
                                  cellX,
                                  cellY,
                                  boxWidth,
                                  boxHeight,
                                  "F"
                                );
                                break;
                              case 4:
                                doc.setFillColor(0, 128, 0); // Green
                                doc.rect(
                                  cellX,
                                  cellY,
                                  boxWidth,
                                  boxHeight,
                                  "F"
                                );
                                break;
                              default:
                                break;
                            }
                          }
                        }
                      },
                    });

                    addFooter(doc);

                    yPosition = 20; // Initialize yPosition for the first page
                    let annexureIndex = 1;

                    for (const service of servicesData) {
                      // Add a new page for each service
                      doc.addPage();
                      addFooter(doc);

                      let yPosition = 20; // Reset yPosition to the top margin

                      const reportFormJson = JSON.parse(
                        service.reportFormJson.json
                      );
                      const rows = reportFormJson.rows || [];
                      const serviceData = [];

                      // Process each row to build service data
                      rows.forEach((row) => {
                        const inputLabel = row.label || "";
                        const valuesObj = {};

                        row.inputs.forEach((input) => {
                          const inputName = input.name;
                          let verifiedInputName = `verified_${inputName}`;

                          // Handle "verified_" prefix adjustments
                          verifiedInputName = verifiedInputName.replace(
                            "verified_verified_",
                            "verified_"
                          );
                          if (input.label && typeof input.label === "string") {
                            input.label = input.label.replace(/:/g, ""); // Remove colons from labels
                          }

                          // Fetch value and verified value from annexureData
                          const value = service.annexureData[inputName] || "";
                          const verifiedValue =
                            service.annexureData[verifiedInputName] || "";

                          valuesObj[inputName] = value;
                          if (verifiedValue) {
                            valuesObj[verifiedInputName] = verifiedValue;
                            valuesObj["isVerifiedExist"] = true;
                          } else {
                            valuesObj["isVerifiedExist"] = false;
                          }

                          valuesObj["name"] = inputName.replace(
                            "verified_",
                            ""
                          ); // Simplify the name
                        });

                        serviceData.push({
                          label: inputLabel,
                          values: valuesObj,
                        });
                      });

                      // Build table data
                      const tableData = serviceData
                        .map((data) => {
                          if (!data || !data.values) {
                            console.log(
                              "Skipping invalid data (empty values)."
                            );
                            return null;
                          }
                          const name = data.values.name;
                          if (!name || name.startsWith("annexure")) return null;

                          const isVerifiedExist = data.values.isVerifiedExist;
                          const value = data.values[name];
                          const verified = data.values[`verified_${name}`];

                          if (value === undefined) return null;

                          // Return appropriate row based on verified status
                          return verified
                            ? [data.label, value, verified]
                            : [data.label, value];
                        })
                        .filter((item) => item !== null);

                      // Validate table data
                      if (tableData.length === 0) {
                        console.error(
                          "No valid data found for table rendering."
                        );
                      }

                      const pageWidth = doc.internal.pageSize.width;

                      // Add heading
                      const headingText = reportFormJson.heading.toUpperCase();
                      const backgroundColor = "#f5f5f5";
                      const borderColor = "#3d75a6";
                      const xsPosition = 10;
                      const rectHeight = 10;

                      doc.setFillColor(backgroundColor);
                      doc.setDrawColor(borderColor);
                      doc.rect(
                        xsPosition,
                        yPosition,
                        pageWidth - 20,
                        rectHeight,
                        "FD"
                      );

                      doc.setFontSize(12);
                      doc.setFont("helvetica", "bold");

                      // Calculate text height to properly center it vertically in the rectangle
                      const textHeight = doc.getTextDimensions(headingText).h;
                      const verticalCenter =
                        yPosition + rectHeight / 2 + textHeight / 4; // Adjust using text height

                      doc.text(headingText, pageWidth / 2, verticalCenter, {
                        align: "center",
                      });

                      yPosition += rectHeight + 0; // Adjust yPosition for the next section
                      // Adjust yPosition after heading

                      // Add table
                      doc.autoTable({
                        head: [
                          [
                            {
                              content: "PARTICULARS",
                              styles: { halign: "left" },
                            },
                            "APPLICANT DETAILS",
                            "VERIFIED DETAILS",
                          ],
                        ],
                        body: tableData.map((row) => {
                          if (row.length === 2) {
                            // Merge columns for "Applicant Details" if no "Verified Details"
                            return [
                              { content: row[0], styles: { halign: "left" } },
                              {
                                content: row[1],
                                colSpan: 2,
                                styles: { halign: "left" },
                              },
                            ];
                          } else {
                            // Normal row with all columns
                            return [
                              { content: row[0], styles: { halign: "left" } },
                              { content: row[1], styles: { halign: "left" } },
                              { content: row[2], styles: { halign: "left" } },
                            ];
                          }
                        }),
                        startY: yPosition,
                        styles: {
                          fontSize: 9,
                          cellPadding: 3,
                          lineWidth: 0.5,
                          lineColor: [62, 118, 165],
                        },
                        columnStyles: {
                          0: { cellWidth: "auto", halign: "left" },
                          1: { cellWidth: "auto", halign: "left" },
                          2: { cellWidth: "auto", halign: "left" },
                        },
                        theme: "grid",
                        headStyles: {
                          fillColor: [255, 255, 255],
                          textColor: [0, 0, 0],
                          halign: "center",
                          fontSize: 10,
                        },
                        bodyStyles: {
                          textColor: [0, 0, 0],
                          halign: "left",
                        },
                        tableLineColor: [62, 118, 165],
                        tableLineWidth: 0.5,
                        margin: { horizontal: 10 },
                      });

                      yPosition = doc.lastAutoTable.finalY + 10; // Update Y position for next section

                      // Add Remarks
                      const remarksData = serviceData.find(
                        (data) => data.label === "Remarks"
                      );
                      if (remarksData) {
                        const remarks =
                          remarksData.values.name || "No remarks available.";
                        doc.setFont("helvetica", "italic");
                        doc.setFontSize(10);
                        doc.setTextColor(100, 100, 100);
                        doc.text(`Remarks: ${remarks}`, 10, yPosition);
                        yPosition += 10;
                      }

                      // Handle annexure images
                      // Handle annexure images
                      const annexureImagesKey = Object.keys(
                        service.annexureData
                      ).find(
                        (key) =>
                          key.toLowerCase().startsWith("annexure") &&
                          !key.includes("[") &&
                          !key.includes("]")
                      );

                      if (annexureImagesKey) {
                        const annexureImagesStr =
                          service.annexureData[annexureImagesKey];
                        const annexureImagesSplitArr = annexureImagesStr
                          ? annexureImagesStr.split(",")
                          : [];

                        if (annexureImagesSplitArr.length === 0) {
                          doc.setFont("helvetica", "italic");
                          doc.setFontSize(10);
                          doc.setTextColor(150, 150, 150);
                          doc.text(
                            "No annexure images available.",
                            10,
                            yPosition
                          );
                          yPosition += 15;
                        } else {
                          for (const [
                            index,
                            imageUrl,
                          ] of annexureImagesSplitArr.entries()) {
                            const imageUrlFull = imageUrl.trim();
                            const imageFormat = getImageFormat(imageUrlFull);
                            if (!(await checkImageExists(imageUrlFull)))
                              continue;

                            const img = await validateImage(imageUrlFull);
                            if (!img) {
                              console.warn(`Invalid image: ${imageUrlFull}`);
                              continue;
                            }

                            try {
                              const { width, height } = scaleImage(
                                img,
                                doc.internal.pageSize.width - 20,
                                80
                              );
                              if (
                                yPosition + height >
                                doc.internal.pageSize.height - 20
                              ) {
                                doc.addPage();
                                yPosition = 20;
                              }

                              const annexureText = `Annexure ${annexureIndex} (${String.fromCharCode(
                                97 + index
                              )})`;
                              const textWidth = doc.getTextWidth(annexureText);
                              const centerX =
                                (doc.internal.pageSize.width - textWidth) / 2;
                              doc.setFont("helvetica", "normal");
                              doc.setFontSize(10);
                              doc.text(annexureText, centerX, yPosition);
                              yPosition += 15;

                              const centerXImage =
                                (doc.internal.pageSize.width - width) / 2;
                              doc.addImage(
                                await fetchImageAsBase64(img.src),
                                imageFormat,
                                centerXImage,
                                yPosition,
                                width,
                                height
                              );
                              yPosition += height + 15;
                            } catch (error) {
                              console.error(
                                `Failed to add image to PDF: ${imageUrlFull}`,
                                error
                              );
                            }
                          }
                        }
                      } else {
                        doc.setFont("helvetica", "italic");
                        doc.setFontSize(10);
                        doc.setTextColor(150, 150, 150);
                        doc.text(
                          "No annexure images available.",
                          10,
                          yPosition
                        );
                        yPosition += 15;
                      }
                      addFooter(doc);
                      annexureIndex++;
                      yPosition += 30;
                    }

                    // Add disclaimer after all services
                    doc.addPage();
                    addFooter(doc);

                    // Define Disclaimer Button Dimensions
                    const disclaimerButtonHeight = 10; // Button height (without padding)
                    const disclaimerButtonWidth =
                      doc.internal.pageSize.width - 20; // Full width minus margins

                    // Constants for additional spacing
                    const buttonBottomPadding = 5; // Padding below the button
                    const disclaimerTextTopMargin = 5; // Margin from top of the disclaimer text

                    // Adjusted Disclaimer Button Height (includes padding)
                    const adjustedDisclaimerButtonHeight =
                      disclaimerButtonHeight + buttonBottomPadding;

                    // Define Disclaimer Text
                    const disclaimerTextPart1 = `This report is confidential and is meant for the exclusive use of the Client. This report has been prepared solely for the purpose set out pursuant to our letter of engagement (LoE)/Agreement signed with you and is not to be used for any other purpose. The Client recognizes that we are not the source of the data gathered and our reports are based on the information provided. The Client is responsible for employment decisions based on the information provided in this report.You can mail us at `;
                    const anchorText = "compliance@screeningstar.com";
                    const disclaimerTextPart2 = " for any clarifications.";

                    // Dynamically calculate disclaimer text height
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0); // Set text color to #000 (black)
                    const disclaimerLinesPart1 = doc.splitTextToSize(
                      disclaimerTextPart1,
                      disclaimerButtonWidth
                    );
                    const disclaimerLinesPart2 = doc.splitTextToSize(
                      disclaimerTextPart2,
                      disclaimerButtonWidth
                    );

                    // Adjusted Y position for disclaimer text
                    const lineHeight = 7; // Increased line height for better readability
                    const disclaimerTextHeight =
                      disclaimerLinesPart1.length * lineHeight +
                      disclaimerLinesPart2.length * lineHeight +
                      lineHeight; // Include space for anchor

                    // Calculate total space required for the disclaimer (button + text)
                    const totalContentHeight =
                      adjustedDisclaimerButtonHeight +
                      disclaimerTextHeight +
                      disclaimerTextTopMargin;

                    // Calculate the available space from top to bottom
                    const availableSpace = doc.internal.pageSize.height - 40; // Total page height minus some margin

                    // Calculate the starting position for the content to be centered vertically
                    let disclaimerY =
                      (availableSpace - totalContentHeight) / 2 + 20; // Add top margin (20)

                    // Add new page if disclaimer doesn't fit
                    if (disclaimerY < 20) {
                      doc.addPage();
                      addFooter(doc);
                      disclaimerY = 20; // Start from the top of the new page if space is insufficient
                    }

                    // Draw Disclaimer Button (centered horizontally)
                    const disclaimerButtonXPosition =
                      (doc.internal.pageSize.width - disclaimerButtonWidth) / 2; // Centering horizontally
                    doc.setDrawColor(62, 118, 165); // Set border color
                    doc.setFillColor(backgroundColor); // Set fill color
                    doc.rect(
                      disclaimerButtonXPosition,
                      disclaimerY,
                      disclaimerButtonWidth,
                      disclaimerButtonHeight,
                      "F"
                    ); // Fill the rectangle
                    doc.rect(
                      disclaimerButtonXPosition,
                      disclaimerY,
                      disclaimerButtonWidth,
                      disclaimerButtonHeight,
                      "D"
                    ); // Draw the border
                    doc.setTextColor(0, 0, 0); // Set text color to black
                    doc.setFont("helvetica", "bold");

                    // Center the 'DISCLAIMER' text inside the button both horizontally and vertically
                    const disclaimerButtonTextWidth =
                      doc.getTextWidth("DISCLAIMER"); // Width of the button text
                    const buttonTextHeight = doc.getFontSize(); // Height of the text (font size)

                    // Horizontal centering of text inside the button
                    const disclaimerTextXPosition =
                      disclaimerButtonXPosition +
                      disclaimerButtonWidth / 2 -
                      disclaimerButtonTextWidth / 2 -
                      1;
                    // Vertical centering of text inside the button
                    const disclaimerTextYPosition =
                      disclaimerY +
                      disclaimerButtonHeight / 2 +
                      buttonTextHeight / 4 -
                      1;

                    // Add 'DISCLAIMER' text to the button, centered both horizontally and vertically
                    doc.text(
                      "DISCLAIMER",
                      disclaimerTextXPosition,
                      disclaimerTextYPosition
                    );

                    // Draw Disclaimer Text (Split parts)
                    let currentY =
                      disclaimerY +
                      adjustedDisclaimerButtonHeight +
                      disclaimerTextTopMargin;

                    // Draw Part 1 of the Disclaimer (Black Text)
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(0, 0, 0);
                    disclaimerLinesPart1.forEach((line) => {
                      doc.text(line, 10, currentY);
                      currentY += lineHeight;
                    });

                    // Add Anchor Text (Blue and Clickable)
                    doc.setTextColor(0, 0, 255);
                    doc.textWithLink(
                      anchorText,
                      10 +
                      doc.getTextWidth(
                        disclaimerLinesPart1[disclaimerLinesPart1.length - 1]
                      ),
                      currentY - lineHeight,
                      {
                        url: "mailto:compliance@screeningstar.com",
                      }
                    );

                    // Draw Part 2 of the Disclaimer (Black Text)
                    doc.setTextColor(0, 0, 0);
                    disclaimerLinesPart2.forEach((line) => {
                      doc.text(line, 10, currentY);
                      currentY += lineHeight;
                    });

                    // Place "END OF DETAIL REPORT" button immediately after the disclaimer text
                    let endOfDetailY = currentY + disclaimerTextTopMargin - 5;

                    // Add new page if "END OF DETAIL REPORT" button doesn't fit
                    if (
                      endOfDetailY + disclaimerButtonHeight >
                      doc.internal.pageSize.height - 20
                    ) {
                      doc.addPage();
                      endOfDetailY = 20; // Start from the top of the new page
                    }

                    // Draw "END OF DETAIL REPORT" Button (centered horizontally)
                    const endButtonXPosition =
                      (doc.internal.pageSize.width - disclaimerButtonWidth) / 2; // Centering horizontally
                    doc.setDrawColor(62, 118, 165);
                    doc.setFillColor(backgroundColor);
                    doc.rect(
                      endButtonXPosition,
                      endOfDetailY,
                      disclaimerButtonWidth,
                      disclaimerButtonHeight,
                      "F"
                    );
                    doc.rect(
                      endButtonXPosition,
                      endOfDetailY,
                      disclaimerButtonWidth,
                      disclaimerButtonHeight,
                      "D"
                    );
                    doc.setTextColor(0, 0, 0); // Set text color to black for the button text
                    doc.setFont("helvetica", "bold");

                    // Center the 'END OF DETAIL REPORT' text inside the button both horizontally and vertically
                    const endButtonTextWidth = doc.getTextWidth(
                      "END OF DETAIL REPORT"
                    ); // Width of the button text
                    const endButtonTextHeight = doc.getFontSize(); // Height of the text (font size)

                    // Horizontal centering of text inside the button
                    const endButtonTextXPosition =
                      endButtonXPosition +
                      disclaimerButtonWidth / 2 -
                      endButtonTextWidth / 2 -
                      1;
                    // Vertical centering of text inside the button
                    const endButtonTextYPosition =
                      endOfDetailY +
                      disclaimerButtonHeight / 2 +
                      endButtonTextHeight / 4 -
                      1;

                    // Add 'END OF DETAIL REPORT' text to the button, centered both horizontally and vertically
                    doc.text(
                      "END OF DETAIL REPORT",
                      endButtonTextXPosition,
                      endButtonTextYPosition
                    );

                    // Ensure footer is added
                    addFooter(doc);

                    const pdfPathCloud = await savePdf(
                      doc,
                      pdfFileName,
                      targetDirectory
                    );
                    // doc.save(pdfPath);
                    resolve(pdfPathCloud);
                  } catch (error) {
                    console.error("PDF generation error:", error);
                    reject(new Error("Error generating PDF"));
                  }
                }
              }
            }
          );
        }
      );
    });
  },
};
