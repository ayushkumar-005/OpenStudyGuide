// Global Variables
const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const loadingIndicator = document.getElementById("loading");
const pdfUpload = document.getElementById("pdf-upload");
const imageUpload = document.getElementById("image-upload");
const fileName = document.getElementById("file-name");
const fileIndicator = document.getElementById("file-indicator");
const removeFileBtn = document.getElementById("remove-file");
const darkModeToggle = document.getElementById("dark-mode-toggle");
const darkModeIcon = document.getElementById("dark-mode-icon");
const darkModeText = document.getElementById("dark-mode-text");
const clearChatBtn = document.getElementById("clear-chat-btn");
const exportPdfBtn = document.getElementById("export-pdf-btn");

let conversationHistory = [];
let uploadedFile = null;
let uploadedFileType = null;

// DARK MODE

// Check for saved dark mode preference
if (localStorage.getItem("darkMode") === "enabled") {
    document.body.classList.add("dark-mode");
    darkModeIcon.classList.replace("fa-moon", "fa-sun");
    darkModeText.textContent = "Light";
}

// Dark mode toggle
darkModeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");

    if (document.body.classList.contains("dark-mode")) {
        localStorage.setItem("darkMode", "enabled");
        darkModeIcon.classList.replace("fa-moon", "fa-sun");
        darkModeText.textContent = "Light";
    } else {
        localStorage.setItem("darkMode", "disabled");
        darkModeIcon.classList.replace("fa-sun", "fa-moon");
        darkModeText.textContent = "Dark";
    }
});

// Clear Chat
clearChatBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear the conversation?")) {
        // Remove all messages except the welcome message
        const messages = chatContainer.querySelectorAll(
            ".user-message, .bot-message:not(:first-child)"
        );
        messages.forEach((msg) => msg.remove());

        // Reset conversation history
        conversationHistory = [];

        // Clear file
        clearUploadedFile();

        // Clear input
        userInput.value = "";
    }
});

// File Uploads
pdfUpload.addEventListener("change", (e) => {
    handleFileUpload(e.target.files[0], "pdf");
});

imageUpload.addEventListener("change", (e) => {
    handleFileUpload(e.target.files[0], "image");
});

removeFileBtn.addEventListener("click", () => {
    clearUploadedFile();
});

function handleFileUpload(file, type) {
    if (file) {
        uploadedFile = file;
        uploadedFileType = type;

        fileName.textContent = file.name;
        fileIndicator.classList.remove("hidden");

        addBotMessage(
            `Great! I've received your ${type === "pdf" ? "PDF" : "image"}: **${
                file.name
            }**. Now ask me a question about it!`
        );
    }
}

function clearUploadedFile() {
    uploadedFile = null;
    uploadedFileType = null;
    fileName.textContent = "";
    fileIndicator.classList.add("hidden");
    pdfUpload.value = "";
    imageUpload.value = "";
}

// Send Message
sendBtn.addEventListener("click", sendMessage);

userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const message = userInput.value.trim();

    if (!message) return;

    sendBtn.disabled = true;
    userInput.disabled = true;

    addUserMessage(message);
    userInput.value = "";

    loadingIndicator.classList.remove("hidden");

    try {
        const formData = new FormData();
        formData.append("message", message);
        formData.append(
            "conversation_history",
            JSON.stringify(conversationHistory)
        );

        if (uploadedFile) {
            formData.append("file", uploadedFile);
            formData.append("file_type", uploadedFileType);
        }

        const response = await fetch("/chat", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (data.success) {
            addBotMessage(data.response);
            conversationHistory = data.conversation_history;

            if (uploadedFile) {
                clearUploadedFile();
            }
        } else {
            addBotMessage(`❌ Sorry, something went wrong: ${data.error}`);
        }
    } catch (error) {
        addBotMessage(
            "❌ Sorry, I couldn't connect to the server. Please try again."
        );
        console.error("Error:", error);
    }

    loadingIndicator.classList.add("hidden");
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
}

// Add messages to chat
function addUserMessage(message) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "user-message";
    messageDiv.innerHTML = `
        <div class="message-content">
            ${escapeHtml(message)}
        </div>
    `;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addBotMessage(message) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "bot-message";

    const formattedMessage = formatMarkdown(message);

    messageDiv.innerHTML = `
        <div class="message-content formatted-text">
            ${formattedMessage}
        </div>
    `;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Formatting Markdown for better view
function formatMarkdown(text) {
    let formatted = escapeHtml(text);

    // Tables
    formatted = formatted.replace(
        /^\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/gm,
        function (match, headers, rows) {
            const headerCells = headers
                .split("|")
                .filter((h) => h.trim())
                .map(
                    (h) =>
                        `<th class="border border-gray-300 px-3 py-2 bg-gray-100 font-semibold text-left">${h.trim()}</th>`
                )
                .join("");

            const rowsArray = rows.trim().split("\n");
            const bodyRows = rowsArray
                .map((row) => {
                    const cells = row
                        .split("|")
                        .filter((c) => c.trim())
                        .map(
                            (c) =>
                                `<td class="border border-gray-300 px-3 py-2">${c.trim()}</td>`
                        )
                        .join("");
                    return `<tr>${cells}</tr>`;
                })
                .join("");

            return `<div class="table-wrapper my-4 overflow-x-auto">
            <table class="min-w-full border-collapse border border-gray-300">
                <thead><tr>${headerCells}</tr></thead>
                <tbody>${bodyRows}</tbody>
            </table>
        </div>`;
        }
    );

    // Code blocks
    formatted = formatted.replace(
        /```(\w+)?\n?([\s\S]*?)```/g,
        function (match, lang, code) {
            const language = lang
                ? `<span class="text-xs text-gray-400">${lang}</span>`
                : "";
            return `<div class="code-block my-3">
            ${language}
            <pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto"><code>${code.trim()}</code></pre>
        </div>`;
        }
    );

    // Headings
    formatted = formatted.replace(
        /^### (.+)$/gm,
        '<h3 class="heading-3">$1</h3>'
    );
    formatted = formatted.replace(
        /^## (.+)$/gm,
        '<h2 class="heading-2">$1</h2>'
    );
    formatted = formatted.replace(
        /^# (.+)$/gm,
        '<h1 class="heading-1">$1</h1>'
    );

    // Blockquotes
    formatted = formatted.replace(
        /^&gt; (.+)$/gm,
        '<blockquote class="my-blockquote">$1</blockquote>'
    );

    // Lists
    formatted = formatted.replace(
        /^[\-\*•] (.+)$/gm,
        '<li class="list-item">$1</li>'
    );
    formatted = formatted.replace(
        /(<li class="list-item">.*?<\/li>\n?)+/g,
        '<ul class="my-list unordered">$&</ul>'
    );

    formatted = formatted.replace(
        /^\d+\.\s+(.+)$/gm,
        '<li class="list-item-numbered">$1</li>'
    );
    formatted = formatted.replace(
        /(<li class="list-item-numbered">.*?<\/li>\n?)+/g,
        '<ol class="my-list ordered">$&</ol>'
    );

    // Bold
    formatted = formatted.replace(
        /\*\*(.+?)\*\*/g,
        '<strong class="font-bold">$1</strong>'
    );
    formatted = formatted.replace(
        /__(.+?)__/g,
        '<strong class="font-bold">$1</strong>'
    );

    // Italic
    formatted = formatted.replace(
        /(?<!\*)\*([^\*]+?)\*(?!\*)/g,
        '<em class="italic">$1</em>'
    );
    formatted = formatted.replace(
        /(?<!_)_([^_]+?)_(?!_)/g,
        '<em class="italic">$1</em>'
    );

    // Inline code
    formatted = formatted.replace(
        /`([^`]+)`/g,
        '<code class="inline-code">$1</code>'
    );

    // Paragraphs
    const sections = formatted.split(/\n\n+/);
    formatted = sections
        .map((section) => {
            if (section.match(/^<(h[123]|ul|ol|table|div|pre|blockquote)/)) {
                return section;
            }
            section = section.replace(/\n/g, "<br>");
            return `<p class="my-paragraph">${section}</p>`;
        })
        .join("\n");

    formatted = formatted.replace(/<p class="my-paragraph"><\/p>/g, "");

    return formatted;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Auto-resize textarea
userInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
});

// PDF export functionality

// Text sanitization - converts to pure ASCII
function cleanTextForPDF(text) {
    if (!text) return "";

    let cleaned = String(text);

    // Remove markdown formatting
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, "$1");
    cleaned = cleaned.replace(/__(.+?)__/g, "$1");
    cleaned = cleaned.replace(/\*(.+?)\*/g, "$1");
    cleaned = cleaned.replace(/_(.+?)_/g, "$1");
    cleaned = cleaned.replace(/`(.+?)`/g, "$1");
    cleaned = cleaned.replace(/~~(.+?)~~/g, "$1");

    // Convert unicode quotes and dashes to ASCII equivalents
    cleaned = cleaned.replace(/[""]/g, '"');
    cleaned = cleaned.replace(/['']/g, "'");
    cleaned = cleaned.replace(/[–—―]/g, "-");
    cleaned = cleaned.replace(/[…]/g, "...");

    // Convert bullets to standard
    cleaned = cleaned.replace(/[•●○■◆]/g, "*");

    // Remove ALL Unicode characters that could cause issues
    // Keep only printable ASCII (space to ~)
    cleaned = cleaned
        .split("")
        .map((char) => {
            const code = char.charCodeAt(0);
            // Allow space (32) through tilde (126) only
            if (code >= 32 && code <= 126) {
                return char;
            }
            // Replace everything else with space
            return " ";
        })
        .join("");

    // Collapse multiple spaces into one
    cleaned = cleaned.replace(/\s+/g, " ");

    // Trim
    cleaned = cleaned.trim();

    return cleaned;
}

// Manual word-based text wrapping (avoids jsPDF splitTextToSize bug)
function wrapText(doc, text, maxWidth) {
    text = cleanTextForPDF(text);

    if (!text || text.length === 0) {
        return [];
    }

    // Split by words
    const words = text.split(" ").filter((w) => w.length > 0);
    const lines = [];
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine + (currentLine ? " " : "") + word;

        let lineWidth;
        try {
            lineWidth = doc.getTextWidth(testLine);
        } catch (e) {
            // If we can't measure, assume it's too long
            lineWidth = maxWidth + 1;
        }

        if (lineWidth > maxWidth && currentLine) {
            // Line is full, save it and start new line
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }

    // Add the last line
    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [""];
}

// Process markdown content into structured elements
function processMessageForPDF(text) {
    const elements = [];
    const lines = text.split("\n");

    let inCodeBlock = false;
    let codeContent = "";
    let currentTable = null;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Code blocks
        if (line.trim().startsWith("```")) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeContent = "";
                continue;
            } else {
                inCodeBlock = false;
                if (codeContent.trim()) {
                    elements.push({
                        type: "code",
                        content: codeContent.trim(),
                    });
                }
                codeContent = "";
                continue;
            }
        }

        if (inCodeBlock) {
            codeContent += line + "\n";
            continue;
        }

        // Tables
        if (line.includes("|") && line.trim().startsWith("|")) {
            if (line.match(/^\|[\s\-:]+\|/)) {
                continue;
            }

            const cells = line
                .split("|")
                .map((cell) => cleanTextForPDF(cell))
                .filter((cell) => cell.length > 0);

            if (cells.length > 0) {
                if (!currentTable) {
                    currentTable = { type: "table", rows: [] };
                }
                currentTable.rows.push(cells);
            }
            continue;
        } else if (currentTable) {
            elements.push(currentTable);
            currentTable = null;
        }

        // Headings
        if (line.startsWith("# ")) {
            elements.push({
                type: "heading",
                level: 1,
                content: cleanTextForPDF(line.substring(2)),
            });
            continue;
        } else if (line.startsWith("## ")) {
            elements.push({
                type: "heading",
                level: 2,
                content: cleanTextForPDF(line.substring(3)),
            });
            continue;
        } else if (line.startsWith("### ")) {
            elements.push({
                type: "heading",
                level: 3,
                content: cleanTextForPDF(line.substring(4)),
            });
            continue;
        }

        // Lists
        if (line.match(/^[\-\*•]\s+/)) {
            const content = line.replace(/^[\-\*•]\s+/, "");
            elements.push({ type: "list", content: cleanTextForPDF(content) });
            continue;
        }

        if (line.match(/^\d+\.\s+/)) {
            const content = line.replace(/^\d+\.\s+/, "");
            elements.push({ type: "list", content: cleanTextForPDF(content) });
            continue;
        }

        // Horizontal rules
        if (line.trim().match(/^[\-]{3,}$/)) {
            elements.push({ type: "hr" });
            continue;
        }

        // Regular text
        if (line.trim()) {
            elements.push({ type: "text", content: cleanTextForPDF(line) });
        }
    }

    if (currentTable) {
        elements.push(currentTable);
    }

    return elements;
}

// Export button click handler
exportPdfBtn.addEventListener("click", () => {
    if (conversationHistory.length === 0) {
        alert("No conversation to export yet!");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    function addNewPageIfNeeded(spaceNeeded) {
        if (y + spaceNeeded > pageHeight - 20) {
            doc.addPage();
            y = 20;
        }
    }

    // Title Page
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text("OpenStudyGuide", pageWidth / 2, 50, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Study Session Export", pageWidth / 2, 62, { align: "center" });

    doc.setFontSize(9);
    const date = new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
    doc.text(date, pageWidth / 2, 72, { align: "center" });

    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1);
    doc.line(40, 82, pageWidth - 40, 82);

    y = 100;

    // Conversation Content
    conversationHistory.forEach((msg, index) => {
        addNewPageIfNeeded(35);

        const isUser = msg.role === "user";

        // Message header background
        doc.setFillColor(
            isUser ? 37 : 243,
            isUser ? 99 : 244,
            isUser ? 235 : 246
        );
        doc.rect(margin, y - 6, maxWidth, 10, "F");

        // Role label
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(
            isUser ? 255 : 75,
            isUser ? 255 : 85,
            isUser ? 255 : 99
        );
        const roleText = isUser ? "YOU" : "AI ASSISTANT";
        doc.text(roleText, margin + 4, y);

        y += 10;

        // Process message content
        const processedContent = processMessageForPDF(msg.content);

        processedContent.forEach((element) => {
            if (element.type === "text") {
                // Regular Text
                addNewPageIfNeeded(15);
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(40, 40, 40);

                const lines = wrapText(doc, element.content, maxWidth - 6);
                lines.forEach((line) => {
                    addNewPageIfNeeded(6);
                    doc.text(line, margin + 3, y);
                    y += 5;
                });
                y += 3;
            } else if (element.type === "heading") {
                // Headings
                addNewPageIfNeeded(12);
                doc.setFontSize(
                    element.level === 1 ? 14 : element.level === 2 ? 12 : 11
                );
                doc.setFont("helvetica", "bold");
                doc.setTextColor(37, 99, 235);

                const lines = wrapText(doc, element.content, maxWidth - 6);
                lines.forEach((line) => {
                    addNewPageIfNeeded(7);
                    doc.text(line, margin + 3, y);
                    y += 6;
                });
                y += 4;
            } else if (element.type === "list") {
                // List Items
                addNewPageIfNeeded(10);
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(40, 40, 40);

                doc.text("*", margin + 5, y);

                const lines = wrapText(doc, element.content, maxWidth - 15);
                lines.forEach((line, idx) => {
                    addNewPageIfNeeded(6);
                    doc.text(line, margin + 12, y);
                    if (idx < lines.length - 1) y += 5;
                });
                y += 7;
            } else if (element.type === "code") {
                // Code Blocks
                addNewPageIfNeeded(15);
                doc.setFillColor(245, 245, 245);

                const lines = element.content.split("\n");
                const blockHeight = lines.length * 5 + 6;

                doc.rect(margin + 3, y - 4, maxWidth - 6, blockHeight, "F");

                doc.setFontSize(9);
                doc.setFont("courier", "normal");
                doc.setTextColor(80, 80, 80);

                lines.forEach((line) => {
                    addNewPageIfNeeded(6);
                    const cleanLine = cleanTextForPDF(line);
                    if (cleanLine.length > 80) {
                        doc.text(
                            cleanLine.substring(0, 77) + "...",
                            margin + 6,
                            y
                        );
                    } else {
                        doc.text(cleanLine, margin + 6, y);
                    }
                    y += 5;
                });
                y += 6;
            } else if (element.type === "table") {
                // Tables
                addNewPageIfNeeded(20);

                const numColumns = Math.max(
                    ...element.rows.map((row) => row.length)
                );
                const tableWidth = maxWidth - 10;
                const colWidth = tableWidth / numColumns;
                const cellPadding = 2;

                // Header background
                doc.setFillColor(240, 242, 245);
                doc.rect(margin + 5, y - 2, tableWidth, 8, "F");

                element.rows.forEach((row, rowIdx) => {
                    const isHeader = rowIdx === 0;

                    if (isHeader) {
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(9);
                        doc.setTextColor(37, 99, 235);
                    } else {
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(9);
                        doc.setTextColor(40, 40, 40);
                    }

                    let maxCellLines = 1;
                    const cellContents = [];

                    row.forEach((cell, colIdx) => {
                        const xPos = margin + 5 + colIdx * colWidth;
                        const cellText = wrapText(
                            doc,
                            cell,
                            colWidth - cellPadding * 2
                        );
                        cellContents.push({ xPos, cellText });
                        maxCellLines = Math.max(maxCellLines, cellText.length);
                    });

                    const actualRowHeight = maxCellLines * 5 + 4;
                    addNewPageIfNeeded(actualRowHeight + 5);

                    // Zebra striping
                    if (!isHeader && rowIdx % 2 === 0) {
                        doc.setFillColor(250, 250, 250);
                        doc.rect(
                            margin + 5,
                            y - 2,
                            tableWidth,
                            actualRowHeight,
                            "F"
                        );
                    }

                    // Draw cells
                    doc.setDrawColor(200, 200, 200);
                    doc.setLineWidth(0.2);

                    cellContents.forEach((cellContent) => {
                        const xPos = cellContent.xPos;
                        doc.rect(xPos, y - 2, colWidth, actualRowHeight);

                        cellContent.cellText.forEach((line, lineIdx) => {
                            doc.text(
                                line,
                                xPos + cellPadding,
                                y + 3 + lineIdx * 5
                            );
                        });
                    });

                    y += actualRowHeight;
                });

                y += 8;
            } else if (element.type === "hr") {
                // Horizontal Rule
                addNewPageIfNeeded(8);
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.5);
                doc.line(margin + 20, y, pageWidth - margin - 20, y);
                y += 8;
            }
        });

        y += 8;

        // Separator between messages
        if (index < conversationHistory.length - 1) {
            addNewPageIfNeeded(5);
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.3);
            doc.line(margin + 20, y - 4, pageWidth - margin - 20, y - 4);
            y += 4;
        }
    });

    // Page numbers on pdf
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        doc.text(
            "OpenStudyGuide - Page " + i + " of " + totalPages,
            pageWidth / 2,
            pageHeight - 10,
            { align: "center" }
        );
    }

    // Save PDF
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    doc.save("OpenStudyGuide_" + timestamp + ".pdf");

    addBotMessage("PDF exported successfully! Check your downloads folder.");
});
