import React from "react";
import type { LiveCaseItem, Patient } from "../types/caseTypes";

interface CaseTableViewProps {
  filteredData: LiveCaseItem[];
  uploadStatus: Record<string, string>;
  selectedPatients: Set<string>;
  togglePatientSelection: (caseId: string, index: number) => void;
  allSelected: boolean;
  toggleSelectAll: () => void;
  loading: boolean;
}

const CaseTableView: React.FC<CaseTableViewProps> = ({
  filteredData,
  uploadStatus,
  selectedPatients,
  togglePatientSelection,
  allSelected,
  toggleSelectAll,
  loading,
}) => {
  return (
    <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
      <table className="min-w-full text-sm text-gray-700">
        <thead className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-gray-200">
          <tr>
            {[
              "S.No.",
              "Case ID",
              "Case Owner",
              "Patient Name",
              "Status",
              "Select",
            ].map((header) => (
              <th
                key={header}
                className="px-4 py-3 font-semibold text-gray-700 text-center"
              >
                {header === "Select" ? (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-blue-600"
                  />
                ) : (
                  header
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {filteredData.length > 0 ? (
            filteredData.map((item, caseIndex) => {
              const patients = item.patients?.length
                ? item.patients
                : [
                    {
                      patientName: "Single Unit Case",
                      status: item.caseStatus || "-",
                    },
                  ];

              return patients.map((patient: Patient, patientIndex: number) => {
                const key = `${item.caseId}-${patientIndex}`;
                const isChecked = selectedPatients.has(key);
                const status =
                  uploadStatus[key] || patient.status || item.caseStatus || "-";

                return (
                  <tr
                    key={key}
                    className={`transition-colors hover:bg-blue-50 ${
                      status === "uploaded"
                        ? "bg-green-50"
                        : status === "failed"
                        ? "bg-red-50"
                        : ""
                    }`}
                  >
                    {patientIndex === 0 && (
                      <>
                        <td
                          rowSpan={patients.length}
                          className="px-4 py-3 text-center font-semibold text-gray-800"
                        >
                          {caseIndex + 1}
                        </td>
                        <td
                          rowSpan={patients.length}
                          className="px-4 py-3 text-center text-gray-700 font-medium"
                        >
                          {item.caseId}
                        </td>
                        <td
                          rowSpan={patients.length}
                          className="px-4 py-3 text-center text-gray-700"
                        >
                          {item.caseOwner}
                        </td>
                      </>
                    )}

                    <td className="px-4 py-3 text-center">
                      {patient.patientName || "Single Unit Case"}
                    </td>

                    <td
                      className={`px-4 py-3 text-center font-semibold ${
                        status === "uploaded"
                          ? "text-green-600"
                          : status === "failed"
                          ? "text-red-600"
                          : status === "uploading"
                          ? "text-yellow-600"
                          : "text-gray-600"
                      }`}
                    >
                      {status}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          togglePatientSelection(item.caseId, patientIndex)
                        }
                        disabled={loading || status === "uploaded"}
                        className={`w-4 h-4 accent-blue-600 ${
                          status === "uploaded"
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      />
                    </td>
                  </tr>
                );
              });
            })
          ) : (
            <tr>
              <td colSpan={8} className="text-center py-6 text-gray-400 italic">
                No cases found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default CaseTableView;
