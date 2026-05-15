import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { CallLogListResponse, CampaignContactResponse, ContactType } from "../services/callLogService";
import { formatEndedReason } from "../components/calls/CallDetailDrawer";
import { formatDateTime } from "./dateUtils";

export const ExportToExcel = (data: CallLogListResponse, fileName: string, timezone: string = "Asia/Kolkata") => {

    const exportData = data.items.map((log) => ({
        Phone: log.phone,
        Contact: log.contact || "-",
        Agent: log.agent || "-",
        Campaign: log.campaign || "-",
        "Start Time": formatDateTime(log.startTime, timezone),
        "End Time": formatDateTime(log.endTime, timezone),
        Source: log.source || "-",
        Type: log.type,
        Status: log.status,
        Duration: log.duration,
        Sentiment: log.sentiment || "-",
        "Conversion Outcome": log.lead_qualified_status || "-",
        "End Reason": formatEndedReason(log.ended_reason),
        "Test Call": log.testCall ? "Yes" : "No",
        Date: formatDateTime(log.date, timezone),
        "Call Summary": log.call_summary || "-",
        "Follow Up Recommended":
            log.follow_up_recommended?.join(", ") || "-",
        "Lead Quality":
            log.lead_info?.lead_quality
                ? `${log.lead_info.lead_quality.label || ""} (${log.lead_info.lead_quality.rate || 0})`
                : "-",
        "Follow Up Score":
            log.lead_info?.follow_up
                ? `${log.lead_info.follow_up.label || ""} (${log.lead_info.follow_up.rate || 0})`
                : "-",
        "Transcript":
            log.transcript?.map(t =>
                `[${t.speaker}] ${t.text}`
            ).join("\n") || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Call Logs");

    const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array"
    });

    const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8"
    });

    saveAs(blob, `${fileName}_${Date.now()}.xlsx`);
}

export const ExportContactToExcel = (data: CampaignContactResponse[], type: ContactType, fileName: string) => {
    var exportData
    if (type == "all" || type == "pending") {
        exportData = data.map((contact) => ({
            Name: contact.name,
            Phone: contact.phone,
            Email: contact.email || "-",
        }));
    } else {
        exportData = data.map((contact) => ({
            Name: contact.name,
            Phone: contact.phone,
            Email: contact.email || "-",
            Status: contact.status || "-",
            "Ended Reason": contact.ended_reason || "-",
            Date: formatDateTime(contact.date),
        }));
    }
    console.log("Exported Data", exportData);
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, fileName);

    const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array"
    });

    const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8"
    });

    saveAs(blob, `${fileName}_${Date.now()}.xlsx`);
}