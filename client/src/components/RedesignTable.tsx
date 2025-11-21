import React, { useState } from "react";
import type {
  RedesignCaseTableProps,
  RedesignSeletedItem,
  UploadResponse,
} from "../types/caseTypes";
import RedesignTableView from "./RedesignTableView";

const RedesignTable: React.FC<RedesignCaseTableProps> = ({
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

  const filteredData = (data || []).filter((item) =>
    item.caseId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const togglePatientSelection = (
    caseId: string,
    attempt: number,
    index: number
  ) => {
    const key = `${caseId}-${attempt}-${index}`;
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
        global: "⚠️ No patients selected.",
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
    const selectedData: RedesignSeletedItem[] = [];

    filteredData.forEach((item) => {
      const patients =
        item.patients && item.patients.length > 0
          ? item.patients
          : [{ patientName: "Single Unit Case" }];

      patients.forEach((p, i) => {
        const key = `${item.caseId}-${item.attempt}-${i}`;
        if (selectedPatients.has(key)) {
          selectedData.push({
            caseId: item.caseId,
            patientName:
              p.patientName === "Single Unit Case" ? "" : p.patientName || "",
            caseOwner: item.caseOwner,
            attempt: item.attempt,
            activeDate,
            priority: item.priority,
            key,
          });
        }
      });
    });

    if (selectedData.length === 0) {
      setUploadStatus((prev) => ({
        ...prev,
        global: "⚠️ No patients selected.",
      }));
      return;
    }

    setLoading(true);
    setUploadStatus(
      Object.fromEntries(selectedData.map((d) => [d.key, "uploading"]))
    );

    try {
      const res = await fetch("http://localhost:5000/api/upload/redesign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cases: selectedData,
          passkey: enteredPasskey.trim(),
        }),
      });

      const result: UploadResponse = await res.json();

      if (!res.ok) {
        selectedData.forEach((d) =>
          setUploadStatus((prev) => ({ ...prev, [d.key]: "failed" }))
        );
      } else {
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
        if (result.results.every((r) => r.status === "uploaded")) {
          setTimeout(() => onRefresh?.(), 800);
        }
      }
    } catch (err) {
      console.error("💥 Upload error:", err);
      selectedData.forEach((d) =>
        setUploadStatus((prev) => ({ ...prev, [d.key]: "failed" }))
      );
    } finally {
      setLoading(false);
    }
  };

  // Compute select-all state
  const eligibleKeys: string[] = [];
  filteredData.forEach((item) => {
    const patients =
      item.patients && item.patients.length > 0
        ? item.patients
        : [{ patientName: "Single Unit Case", status: "-" }];
    patients.forEach((p, i) => {
      const key = `${item.caseId}-${item.attempt}-${i}`;
      if (p.status !== "uploaded" && uploadStatus[key] !== "uploaded")
        eligibleKeys.push(key);
    });
  });

  const allSelected = eligibleKeys.every((k) => selectedPatients.has(k));
  const toggleSelectAll = () => {
    const updated = new Set(selectedPatients);
    if (allSelected) eligibleKeys.forEach((k) => updated.delete(k));
    else eligibleKeys.forEach((k) => updated.add(k));
    setSelectedPatients(updated);
  };

  return (
    <>
      <RedesignTableView
        activeToken={activeToken}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        allSelected={allSelected}
        toggleSelectAll={toggleSelectAll}
        filteredData={filteredData}
        selectedPatients={selectedPatients}
        togglePatientSelection={togglePatientSelection}
        uploadStatus={uploadStatus}
        loading={loading}
        // Replace direct submit with modal trigger
        handleSubmit={handleUploadClick}
        globalMessage={uploadStatus.global}
      />

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
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
    </>
  );
};

export default RedesignTable;
