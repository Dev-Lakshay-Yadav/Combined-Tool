import React, { useState } from "react";
import type { LiveCaseTableProps, UploadResponse } from "../types/caseTypes";
import CaseTableView from "./CaseTableView";

const LiveCaseTable: React.FC<LiveCaseTableProps> = ({
  data,
  activeDate,
  activeToken,
  onRefresh,
  passwords, // array of valid passkeys
}) => {
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<Record<string, string>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [enteredPasskey, setEnteredPasskey] = useState("");
  const [passkeyError, setPasskeyError] = useState("");

  if (!activeDate || !activeToken)
    return (
      <div className="p-10 text-gray-600 text-center text-lg font-medium bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-sm border border-gray-200">
        Select a date and token to view data
      </div>
    );

  const tableData = data[activeDate]?.[activeToken] || [];
  const searchString = searchQuery.toLowerCase();
  const filteredData = tableData.filter((item) =>
    item.caseId.toLowerCase().includes(searchString)
  );

  const togglePatientSelection = (caseId: string, index: number) => {
    const key = `${caseId}-${index}`;
    setSelectedPatients((prev) => {
      const updated = new Set(prev);
      if (updated.has(key)) updated.delete(key);
      else updated.add(key);
      return updated;
    });
  };

  // Show modal before upload
  const handleUploadClick = () => {
    if (selectedPatients.size === 0) {
      setUploadStatus((prev) => ({
        ...prev,
        global: "⚠️ No patients selected for upload.",
      }));
      return;
    }
    setShowConfirmModal(true);
    setPasskeyError("");
    setEnteredPasskey("");
  };

  const handleConfirmUpload = async () => {
    if (!enteredPasskey.trim()) {
      setPasskeyError("Please enter your passkey.");
      return;
    }

    const valid = passwords.some(
      (p) => p.trim().toLowerCase() === enteredPasskey.trim().toLowerCase()
    );

    if (!valid) {
      setPasskeyError("❌ Invalid passkey. Please try again.");
      return;
    }

    setShowConfirmModal(false);
    setPasskeyError("");
    await handleSubmit();
  };

  const handleSubmit = async () => {
    const selectedData: {
      caseId: string;
      patientName: string;
      caseOwner: string;
      activeDate: string;
      key: string;
    }[] = [];

    filteredData.forEach((item) => {
      const patients = item.patients?.length
        ? item.patients
        : [{ patientName: "Single Unit Case" }];

      patients.forEach((p, i) => {
        const key = `${item.caseId}-${i}`;
        if (selectedPatients.has(key)) {
          selectedData.push({
            caseId: item.caseId,
            patientName:
              p.patientName === "Single Unit Case" ? "" : p.patientName || "",
            caseOwner: item.caseOwner,
            activeDate,
            key,
          });
        }
      });
    });

    setLoading(true);
    setUploadStatus(
      Object.fromEntries(selectedData.map((d) => [d.key, "uploading"]))
    );

    try {
      const response = await fetch("http://localhost:5000/api/upload/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cases: selectedData,
          passkey: enteredPasskey.trim(), // send the validated passkey
        }),
      });

      const result: UploadResponse = await response.json();
      if (!response.ok) throw new Error("Upload failed");

      result.results.forEach((r) => {
        const match = selectedData.find(
          (d) => d.caseId === r.caseId && d.patientName === r.patientName
        );
        if (match) {
          setUploadStatus((prev) => ({
            ...prev,
            [match.key]: r.status === "uploaded" ? "uploaded" : "failed",
          }));
        }
      });

      const allUploaded = result.results.every((r) => r.status === "uploaded");
      if (allUploaded && onRefresh) setTimeout(() => onRefresh(), 800);
    } catch (error) {
      console.error("💥 Bulk upload network error:", error);
      selectedData.forEach((d) =>
        setUploadStatus((prev) => ({ ...prev, [d.key]: "failed" }))
      );
    } finally {
      setLoading(false);
    }
  };

  // Selection logic
  const allKeys: string[] = [];
  const eligibleKeys: string[] = [];
  filteredData.forEach((item) => {
    const patients = item.patients?.length
      ? item.patients
      : [{ patientName: "Single Unit Case", status: item.caseStatus || "-" }];
    patients.forEach((p, i) => {
      const key = `${item.caseId}-${i}`;
      allKeys.push(key);
      if (p.status !== "uploaded" && uploadStatus[key] !== "uploaded") {
        eligibleKeys.push(key);
      }
    });
  });
  const allSelected =
    eligibleKeys.length > 0 &&
    eligibleKeys.every((k) => selectedPatients.has(k));

  const toggleSelectAll = () => {
    const updated = new Set(selectedPatients);
    if (allSelected) eligibleKeys.forEach((k) => updated.delete(k));
    else eligibleKeys.forEach((k) => updated.add(k));
    setSelectedPatients(updated);
  };


  console.log(passwords,'live')

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
          onClick={handleUploadClick}
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

      {uploadStatus.global && (
        <div className="text-center text-sm text-gray-600 mb-4 font-medium">
          {uploadStatus.global}
        </div>
      )}

      <CaseTableView
        filteredData={filteredData}
        uploadStatus={uploadStatus}
        selectedPatients={selectedPatients}
        togglePatientSelection={togglePatientSelection}
        allSelected={allSelected}
        toggleSelectAll={toggleSelectAll}
        loading={loading}
      />

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-trnasparent flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-96 text-center relative">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">
              Confirm Upload
            </h2>
            <p className="text-gray-600 mb-4">
              Enter your{" "}
              <span className="font-semibold text-blue-600">passkey</span> to
              continue.
            </p>

            <input
              type="password"
              placeholder="Enter passkey..."
              value={enteredPasskey}
              onChange={(e) => setEnteredPasskey(e.target.value)}
              className="border border-gray-300 rounded-xl px-4 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />

            {passkeyError && (
              <div className="text-red-500 text-sm mt-2">{passkeyError}</div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveCaseTable;
