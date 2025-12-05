import fs from "fs";
import PDFGenerator from "pdfkit";

// Types for clarity
interface InstanceDetails {
  toothNumbers?: string[];
  [key: string]: any;
}

interface Service {
  instanceDetails?: InstanceDetails[];
  toothNumbers?: string[];
  teethExtractions?: string[];
  plannedImplantSites?: string[];
  [key: string]: any;
}

interface CaseDetails {
  casePriority?: string;
  patientName: string;
  services: Record<string, Service>;
  additionalNote?: string;
  splintedCrowns?: string;
}

interface CaseActivity {
  type:
    | "system_update"
    | "admin_comment"
    | "super admin_comment"
    | "side admin_comment"
    | "crm_comment"
    | "user_comment"
    | "Redesign_update"
    | string;
  timestamp: number; // unix timestamp
  content: string;
}

export async function generateCasePDF(
  caseId: string,
  caseDetails: CaseDetails,
  filePath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFGenerator();
      const stream = fs.createWriteStream(filePath);

      stream.on("finish", resolve);
      stream.on("error", reject);

      doc.pipe(stream);

      doc.fontSize(24).text(`Case Details for TS-${caseId}`).moveDown();

      if (caseDetails.hasOwnProperty("casePriority")) {
        doc
          .fontSize(20)
          .text(`Case Priority ${caseDetails.casePriority}`)
          .moveDown();
      }

      doc
        .fontSize(16)
        .text(`Patient name - ${caseDetails.patientName}`)
        .moveDown()
        .moveDown();

      const services = caseDetails.services;
      Object.keys(services).forEach((serviceKey) => {
        doc.fontSize(16).text(convertKey(serviceKey));

        const service = services[serviceKey];
        Object.keys(service).forEach((fieldKey) => {
          if (fieldKey === "instanceDetails" && Array.isArray(service[fieldKey])) {
            doc.moveDown();
            doc.fontSize(14).text(convertKey(fieldKey) + ": ");
            const instances = service[fieldKey] as InstanceDetails[];

            instances.forEach((instance, idx) => {
              const answers = Object.keys(instance)
                .map((instanceFieldKey) => {
                  if (
                    instanceFieldKey === "toothNumbers" &&
                    Array.isArray(instance["toothNumbers"])
                  ) {
                    return "Tooth Numbers: " + instance["toothNumbers"].join(",");
                  }
                  return (
                    convertKey(instanceFieldKey) +
                    ": " +
                    instance[instanceFieldKey]
                  );
                })
                .join("\n");

              doc
                .fontSize(12)
                .text("Instance " + (idx + 1).toString() + "\n" + answers + "\n")
                .moveDown();
            });
          } else {
            let text = convertKey(fieldKey) + ": ";
            const value = service[fieldKey];
            text += Array.isArray(value) ? value.join(",") : value;
            doc.fontSize(12).text(text);
          }
        });
        doc.moveDown();
      });

      doc.moveDown();
      doc.fontSize(16).text("Misc. details");

      if (caseDetails.additionalNote) {
        doc
          .fontSize(12)
          .text("Additional Notes: " + caseDetails.additionalNote)
          .moveDown();
      }
      if (caseDetails.splintedCrowns) {
        doc
          .fontSize(12)
          .text("Splinted Crowns: " + caseDetails.splintedCrowns)
          .moveDown();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}


const convertKey = (text: string): string => {
  const result = text.replace(/([A-Z])/g, " $1");
  return result.charAt(0).toUpperCase() + result.slice(1);
};


export async function generateCommentsPDF(
  caseId: string,
  caseActivities: CaseActivity[],
  priority: string,
  filePath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFGenerator();
      const stream = fs.createWriteStream(filePath);

      stream.on("finish", resolve);
      stream.on("error", reject);

      doc.pipe(stream);

      doc.fontSize(24).text(`Comments for TS-${caseId}`);
      doc.moveDown();
      doc.fontSize(20).text(`Case Redesign Priority ${priority}`);
      doc.moveDown().moveDown();

      console.log("redesign CaseActivities : ", caseActivities);

      for (const activity of caseActivities) {
        // REMOVE the old skipping of redesign_update
        if (activity.type === "system_update") {
          continue;
        }

        let author = "";
        let color = "black"; // default

        const type = activity.type?.toLowerCase().trim();

        // --- COLOR LOGIC ---
        if (type === "redesign_update") {
          color = "red";
          author = "Redesign Update";

        } else if (
          type === "admin_comment" ||
          type === "super admin_comment" ||
          type === "crm_comment"
        ) {
          color = "black";
          author = "ToothSketch Team";

        } else if (
          type === "user_comment" ||
          type === "side admin_comment"
        ) {
          color = "blue";
          author = "Client";

        } else {
          // fallback
          author = "Unknown";
          color = "black";
        }

        // Apply text color
        doc.fillColor(color);
        doc.fontSize(12).text(`${author.toUpperCase()} :   ${activity.content}`);

        // Timestamp (gray)
        doc.fillColor("gray");
        doc.fontSize(10).text(
          new Date(activity.timestamp * 1000).toLocaleString()
        );

        doc.moveDown();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}


// export async function generateCommentsPDF(
//   caseId: string,
//   caseActivities: CaseActivity[],
//   priority: string,
//   filePath: string
// ): Promise<void> {
//   return new Promise((resolve, reject) => {
//     try {
//       const doc = new PDFGenerator();
//       const stream = fs.createWriteStream(filePath);

//       stream.on("finish", resolve);
//       stream.on("error", reject);

//       doc.pipe(stream);

//       doc.fontSize(24).text(`Comments for TS-${caseId}`);
//       doc.moveDown();
//       doc.fontSize(20).text(`Case Redesign Priority ${priority}`);
//       doc.moveDown().moveDown();

//       console.log("redesign CaseActivities : ", caseActivities);

//       for (const activity of caseActivities) {
//         if (
//           activity.type === "system_update" ||
//           activity.type === "Redesign_update"
//         ) {
//           continue;
//         }

//         const isTeamComment =
//           activity.type === "admin_comment" ||
//           activity.type === "super admin_comment" ||
//           activity.type === "crm_comment";

//         const author = isTeamComment ? "ToothSketch Team" : "Client";

//         // Set color
//         doc.fillColor(isTeamComment ? "red" : "black");

//         doc.fontSize(12).text(`${author.toUpperCase()} :   ${activity.content}`);

//         // Timestamp in grey
//         doc.fillColor("gray");
//         doc.fontSize(10).text(
//           new Date(activity.timestamp * 1000).toLocaleString()
//         );

//         doc.moveDown();
//       }

//       doc.end();
//     } catch (err) {
//       reject(err);
//     }
//   });
// }
