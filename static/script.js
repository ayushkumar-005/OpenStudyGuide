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

// Export current conversation to PDF
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

    // Helper: Check if we need a new page
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

    // Decorative line
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1);
    doc.line(40, 82, pageWidth - 40, 82);

    y = 100;

    // Conversation
    conversationHistory.forEach((msg, index) => {
        addNewPageIfNeeded(35);

        const isUser = msg.role === "user";

        // Draw colored rectangle for header
        doc.setFillColor(
            isUser ? 37 : 243,
            isUser ? 99 : 244,
            isUser ? 235 : 246
        );
        doc.rect(margin, y - 6, maxWidth, 10, "F");

        // Role label - FIXED: Use plain ASCII text
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(
            isUser ? 255 : 75,
            isUser ? 255 : 85,
            isUser ? 255 : 99
        );

        // Use simple text without special characters
        const roleText = isUser ? "YOU" : "AI ASSISTANT";
        doc.text(roleText, margin + 4, y);

        y += 10;

        // Process message content
        const processedContent = processMessageForPDF(msg.content);

        // Render each element
        processedContent.forEach((element) => {
            if (element.type === "text") {
                // Regular text
                addNewPageIfNeeded(15);
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(40, 40, 40);

                const lines = doc.splitTextToSize(
                    element.content,
                    maxWidth - 6
                );
                lines.forEach((line) => {
                    addNewPageIfNeeded(6);
                    doc.text(line, margin + 3, y);
                    y += 5;
                });
                y += 3;
            } else if (element.type === "heading") {
                // Heading
                addNewPageIfNeeded(12);
                doc.setFontSize(
                    element.level === 1 ? 14 : element.level === 2 ? 12 : 11
                );
                doc.setFont("helvetica", "bold");
                doc.setTextColor(37, 99, 235);

                const lines = doc.splitTextToSize(
                    element.content,
                    maxWidth - 6
                );
                lines.forEach((line) => {
                    addNewPageIfNeeded(7);
                    doc.text(line, margin + 3, y);
                    y += 6;
                });
                y += 4;
            } else if (element.type === "list") {
                // List item
                addNewPageIfNeeded(10);
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(40, 40, 40);

                // Bullet point
                doc.text("•", margin + 5, y);

                // List text
                const lines = doc.splitTextToSize(
                    element.content,
                    maxWidth - 15
                );
                lines.forEach((line, idx) => {
                    addNewPageIfNeeded(6);
                    doc.text(line, margin + 12, y);
                    if (idx < lines.length - 1) y += 5;
                });
                y += 7;
            } else if (element.type === "code") {
                // Code block
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
                    // Truncate very long lines
                    if (line.length > 80) {
                        line = line.substring(0, 77) + "...";
                    }
                    doc.text(line, margin + 6, y);
                    y += 5;
                });
                y += 6;
            } else if (element.type === "table") {
                // Table - render as formatted text
                addNewPageIfNeeded(20);

                doc.setFontSize(10);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(37, 99, 235);
                doc.text("[TABLE]", margin + 3, y);
                y += 6;

                doc.setFont("helvetica", "normal");
                doc.setTextColor(60, 60, 60);

                element.rows.forEach((row, rowIdx) => {
                    addNewPageIfNeeded(8);

                    // Format row
                    const rowText = row.join("  |  ");
                    const lines = doc.splitTextToSize(rowText, maxWidth - 10);

                    if (rowIdx === 0) {
                        // Header row - bold
                        doc.setFont("helvetica", "bold");
                    } else {
                        doc.setFont("helvetica", "normal");
                    }

                    lines.forEach((line) => {
                        addNewPageIfNeeded(6);
                        doc.text(line, margin + 6, y);
                        y += 5;
                    });

                    // Separator after header
                    if (rowIdx === 0) {
                        doc.setDrawColor(200, 200, 200);
                        doc.setLineWidth(0.3);
                        doc.line(
                            margin + 6,
                            y - 1,
                            margin + maxWidth - 6,
                            y - 1
                        );
                        y += 2;
                    }
                });
                y += 5;
            }
        });

        // Space between messages
        y += 8;

        // Separator line
        if (index < conversationHistory.length - 1) {
            addNewPageIfNeeded(5);
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.3);
            doc.line(margin + 20, y - 4, pageWidth - margin - 20, y - 4);
            y += 4;
        }
    });

    // Page numbers on each page
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);

        const footerText = "OpenStudyGuide - Page " + i + " of " + totalPages;
        doc.text(footerText, pageWidth / 2, pageHeight - 10, {
            align: "center",
        });
    }

    // Save
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    doc.save("OpenStudyGuide_" + timestamp + ".pdf");

    // Success message
    addBotMessage("✅ PDF exported successfully! Check your downloads folder.");
});

// Process Message for PDF
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

        // Tables - detect markdown tables
        if (line.includes("|") && line.trim().startsWith("|")) {
            // Check if it's a separator line
            if (line.match(/^\|[\s\-:]+\|/)) {
                continue; // Skip separator lines
            }

            // Parse table row
            const cells = line
                .split("|")
                .map((cell) => cell.trim())
                .filter((cell) => cell.length > 0);

            if (cells.length > 0) {
                if (!currentTable) {
                    currentTable = { type: "table", rows: [] };
                }
                currentTable.rows.push(cells);
            }
            continue;
        } else if (currentTable) {
            // End of table
            elements.push(currentTable);
            currentTable = null;
        }

        // Headings
        if (line.startsWith("# ")) {
            elements.push({
                type: "heading",
                level: 1,
                content: line.substring(2).trim(),
            });
            continue;
        } else if (line.startsWith("## ")) {
            elements.push({
                type: "heading",
                level: 2,
                content: line.substring(3).trim(),
            });
            continue;
        } else if (line.startsWith("### ")) {
            elements.push({
                type: "heading",
                level: 3,
                content: line.substring(4).trim(),
            });
            continue;
        }

        // Lists
        if (line.match(/^[\-\*•]\s+/)) {
            const content = line.replace(/^[\-\*•]\s+/, "").trim();
            elements.push({ type: "list", content: cleanTextForPDF(content) });
            continue;
        }

        if (line.match(/^\d+\.\s+/)) {
            const content = line.replace(/^\d+\.\s+/, "").trim();
            elements.push({ type: "list", content: cleanTextForPDF(content) });
            continue;
        }

        // Regular text
        if (line.trim()) {
            elements.push({ type: "text", content: cleanTextForPDF(line) });
        }
    }

    // Add any remaining table
    if (currentTable) {
        elements.push(currentTable);
    }

    return elements;
}
