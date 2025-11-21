import React from "react";
import type { Patient, RedesignItem } from "../types/caseTypes";

interface RedesignTableViewProps {
  activeToken: string;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  allSelected: boolean;
  toggleSelectAll: () => void;
  filteredData: RedesignItem[];
  selectedPatients: Set<string>;
  togglePatientSelection: (
    caseId: string,
    attempt: number,
    index: number
  ) => void;
  uploadStatus: Record<string, string>;
  loading: boolean;
  handleSubmit: () => void;
  globalMessage?: string;
}

const RedesignTableView: React.FC<RedesignTableViewProps> = ({
  activeToken,
  searchQuery,
  setSearchQuery,
  allSelected,
  toggleSelectAll,
  filteredData,
  selectedPatients,
  togglePatientSelection,
  uploadStatus,
  loading,
  handleSubmit,
  globalMessage,
}) => {
  return (
    <div className="w-full p-6 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xl font-semibold text-blue-700 tracking-tight">
            {activeToken}
          </span>
          <input
            type="text"
            placeholder="🔍 Search Case ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border border-gray-300 rounded-xl px-4 py-2 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 hover:bg-white transition"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={selectedPatients.size === 0 || loading}
          className={`px-6 py-2.5 rounded-xl font-semibold text-white shadow-md transition-all duration-150 ${
            selectedPatients.size > 0 && !loading
              ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-95"
              : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          {loading ? "Uploading..." : "Upload Selected"}
        </button>
      </div>

      {globalMessage && (
        <div className="text-center text-md text-gray-600 mb-4 font-medium">
          {globalMessage}
        </div>
      )}

      {/* Table Section */}
      <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
        <table className="min-w-full text-md text-gray-700">
          <thead className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-gray-200">
            <tr>
              {[
                "S.No.",
                "Case ID",
                "Attempt",
                "Case Owner",
                "Priority",
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
                const patients =
                  item.patients && item.patients.length > 0
                    ? item.patients
                    : [{ patientName: "Single Unit Case", status: "-" }];

                return patients.map(
                  (patient: Patient, patientIndex: number) => {
                    const key = `${item.caseId}-${item.attempt}-${patientIndex}`;
                    const isChecked = selectedPatients.has(key);
                    const status = uploadStatus[key] || patient.status || "-";

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
                              className="px-4 py-3 text-center text-gray-500"
                            >
                              {item.attempt}
                            </td>
                            <td
                              rowSpan={patients.length}
                              className="px-4 py-3 text-center text-gray-700"
                            >
                              {item.caseOwner}
                            </td>
                            <td
                              rowSpan={patients.length}
                              className={`px-4 py-3 text-center font-semibold ${
                                item.priority === "High"
                                  ? "text-red-600"
                                  : "text-blue-600"
                              }`}
                            >
                              {item.priority}
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
                              ? "text-orange-400"
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
                              togglePatientSelection(
                                item.caseId,
                                item.attempt,
                                patientIndex
                              )
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
                  }
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-6 text-gray-400 italic"
                >
                  No cases found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RedesignTableView;
