import { Router } from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import { access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { id, rupees, indiaDate } from "@tamiltrade/shared";
import { z } from "zod";
import { env } from "../config/env.js";
import { assert } from "../shared/errors.js";
import { paise } from "../shared/money.js";
import {
  Invoice,
  Counter,
  Business,
  Contact,
  Record,
  Audit,
  type InvoiceDoc,
} from "./models.js";
import { hashToken, authorize } from "./auth.js";
const amountWords = (n: number): string => {
  const ones = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  const words = (v: number): string => {
    if (v < 20) return ones[v]!;
    if (v < 100)
      return `${tens[Math.floor(v / 10)]}${v % 10 ? " " + ones[v % 10] : ""}`;
    for (const [unit, label] of [
      [10000000, "crore"],
      [100000, "lakh"],
      [1000, "thousand"],
      [100, "hundred"],
    ] as const) {
      if (v >= unit)
        return `${words(Math.floor(v / unit))} ${label}${v % unit ? " " + words(v % unit) : ""}`;
    }
    return "";
  };
  return `${words(Math.floor(n / 100))} rupees${n % 100 ? " and " + words(n % 100) + " paise" : ""} only`;
};
export async function renderPdf(invoice: InvoiceDoc): Promise<Buffer> {
  assert(
    invoice.snapshot && invoice.number,
    409,
    "NOT_ISSUED",
    "Issue the invoice before exporting it",
  );
  const s = invoice.snapshot;
  const tamil = /[\u0b80-\u0bff]/u;
  await Promise.all([
    access(env.PDF_FONT_PATH),
    access(env.PDF_LATIN_FONT_PATH),
  ]).catch(() => {
    throw new Error("Install the licensed PDF fonts using npm run setup:fonts");
  });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 48, bottom: 68, left: 48, right: 48 },
      bufferPages: true,
      info: { Title: invoice.number!, Author: s.business.name },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.registerFont("Tamil", env.PDF_FONT_PATH);
    doc.registerFont("Latin", env.PDF_LATIN_FONT_PATH);
    const ink = "#14232A",
      muted = "#687C84",
      green = "#087F67";
    const font = (value: string) =>
      doc.font(tamil.test(value) ? "Tamil" : "Latin");
    const text = (
      value: string,
      size = 10,
      options: PDFKit.Mixins.TextOptions = {},
    ) => {
      font(value).fontSize(size).text(value, options);
    };
    const positioned = (
      value: string,
      x: number,
      y: number,
      size: number,
      width: number,
      align: "left" | "right" = "left",
    ) => {
      font(value).fontSize(size).text(value, x, y, { width, align });
    };
    doc.rect(0, 0, 595, 8).fill(green);
    doc.fillColor(ink);
    text(s.business.name ?? "", 23, { width: 330 });
    const headerY = doc.y;
    doc.fillColor(muted);
    text(s.business.address ?? "", 9, { width: 320 });
    text(s.business.phone ?? "", 9, { width: 320 });
    if (s.business.taxId)
      text(`Tax ID: ${s.business.taxId}`, 9, { width: 320 });
    const afterHeader = Math.max(doc.y, 110);
    doc.fillColor(green);
    positioned(
      invoice.status === "cancelled" ? "CANCELLED" : "INVOICE",
      380,
      48,
      18,
      167,
      "right",
    );
    doc.fillColor(ink);
    positioned(invoice.number!, 360, 80, 10, 187, "right");
    doc.fillColor(muted);
    positioned(
      `Issued ${invoice.issuedAt ? indiaDate(invoice.issuedAt) : s.sale.date}`,
      360,
      98,
      9,
      187,
      "right",
    );
    doc.y = afterHeader + 28;
    doc.x = 48;
    doc.strokeColor("#DCE5E2").moveTo(48, doc.y).lineTo(547, doc.y).stroke();
    doc.y += 24;
    doc.fillColor(muted);
    text("BILL TO", 9);
    doc.moveDown(0.4);
    doc.fillColor(ink);
    text(s.customer.name ?? "", 15, { width: 330 });
    doc.fillColor(muted);
    text(s.customer.address ?? "", 10, { width: 330 });
    text(s.customer.phone ?? "", 10, { width: 330 });
    doc.moveDown();
    text(
      `Sale date: ${s.sale.date}${s.sale.dueDate ? "   /   Due: " + s.sale.dueDate : ""}`,
      9,
    );
    const y = doc.y + 22;
    doc.roundedRect(48, y, 499, 32, 6).fill("#F0F5F3");
    doc.fillColor(muted);
    positioned("DESCRIPTION", 60, y + 10, 8, 250);
    positioned("QTY", 325, y + 10, 8, 45, "right");
    positioned("RATE", 385, y + 10, 8, 65, "right");
    positioned("AMOUNT", 460, y + 10, 8, 75, "right");
    const itemY = y + 47;
    doc.fillColor(ink);
    positioned(s.productName, 60, itemY, 11, 250);
    const productHeight = font(s.productName)
      .fontSize(11)
      .heightOfString(s.productName, { width: 250 });
    positioned(String(s.sale.quantity), 325, itemY, 10, 45, "right");
    positioned(s.sale.unitPrice!, 380, itemY, 10, 70, "right");
    positioned((s.subtotal / 100).toFixed(2), 455, itemY, 10, 80, "right");
    doc.y = itemY + Math.max(24, productHeight) + 18;
    doc.x = 48;
    doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor("#DCE5E2").stroke();
    doc.y += 18;
    const line = (label: string, value: number) => {
      const rowY = doc.y;
      doc.fillColor(muted);
      positioned(label, 300, rowY, 10, 145);
      doc.fillColor(ink);
      positioned((value / 100).toFixed(2), 455, rowY, 10, 80, "right");
      doc.y = rowY + 23;
      doc.x = 48;
    };
    line("Subtotal", s.subtotal);
    if (s.sale.discount !== "0") line("Discount", -paise(s.sale.discount));
    for (const [key, label] of [
      ["transport", "Transport"],
      ["loading", "Loading"],
      ["unloading", "Unloading"],
      ["otherCosts", "Other charges"],
    ] as const)
      if (paise(s.sale[key])) line(label, paise(s.sale[key]));
    line(`Tax (${s.sale.taxBps / 100}%)`, s.tax);
    const totalY = doc.y + 3;
    doc.roundedRect(288, totalY, 259, 46, 8).fill("#E8F5EE");
    doc.fillColor(green);
    positioned("TOTAL · INR", 302, totalY + 16, 10, 110);
    positioned((s.total / 100).toFixed(2), 412, totalY + 13, 16, 121, "right");
    doc.y = totalY + 64;
    doc.x = 48;
    doc.fillColor(muted);
    text(amountWords(s.total), 9);
    doc.moveDown(1.8);
    doc.fillColor(ink);
    text("PAYMENT DETAILS", 9);
    doc.moveDown(0.4);
    doc.fillColor(muted);
    if (s.business.bankDetails) text(s.business.bankDetails, 10);
    if (s.business.upi) text(`UPI: ${s.business.upi}`, 10);
    if (s.sale.notes) {
      doc.moveDown();
      doc.fillColor(ink);
      text("NOTES & TERMS", 9);
      doc.fillColor(muted);
      text(s.sale.notes, 10);
    }
    doc.moveDown(2);
    doc.fillColor(green);
    text("Thank you for your business. / நன்றி!", 10);
    if (invoice.status === "cancelled") {
      doc.fillColor("#B14B52");
      text("This invoice has been cancelled. Do not use it for payment.", 11);
    }
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fillColor(muted);
      font("Page")
        .fontSize(8)
        .text(
          `${invoice.number}  ·  Page ${i + 1} of ${pages.count}`,
          48,
          doc.page.height - 30,
          { width: 499, align: "right", lineBreak: false },
        );
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}

export const invoiceRouter = Router();
invoiceRouter.use(authorize("invoices"));
invoiceRouter.get("/", async (req, res) => {
  const page = z.coerce.number().int().min(1).default(1).parse(req.query.page),
    limit = 30;
  const scope = { businessId: req.auth.businessId };
  const [items, total] = await Promise.all([
    Invoice.find(scope)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-shareHash")
      .lean(),
    Invoice.countDocuments(scope),
  ]);
  res.json({ items, total, page, limit });
});
invoiceRouter.post("/", async (req, res) => {
  const { saleId } = z.object({ saleId: id }).parse(req.body);
  assert(
    await Record.exists({
      _id: saleId,
      businessId: req.auth.businessId,
      kind: "sale",
      status: "posted",
    }),
    404,
    "SALE_NOT_FOUND",
    "Choose a posted sale",
  );
  const invoice = await Invoice.findOneAndUpdate(
    { businessId: req.auth.businessId, saleId },
    { $setOnInsert: { status: "draft" } },
    { new: true, upsert: true },
  );
  res.status(201).json(invoice);
});
invoiceRouter.post("/:id/issue", async (req, res) => {
  assert(
    req.body.confirm === true,
    422,
    "CONFIRM_REQUIRED",
    "Review the invoice and explicitly confirm issue",
  );
  const invoiceId = id.parse(req.params.id);
  const invoice = await mongoose.connection.transaction(async (session) => {
    const business = await Business.findOneAndUpdate(
      { _id: req.auth.businessId },
      { $inc: { mutationVersion: 1 } },
      { session, new: true },
    );
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      businessId: req.auth.businessId,
    }).session(session);
    assert(invoice && business, 404, "NOT_FOUND", "Invoice not found");
    if (invoice.status === "issued") return invoice;
    assert(
      invoice.status === "draft",
      409,
      "CANCELLED",
      "Cancelled invoices cannot be issued",
    );
    const sale = await Record.findOne({
      _id: invoice.saleId,
      businessId: req.auth.businessId,
      kind: "sale",
      status: "posted",
    }).session(session);
    assert(sale, 409, "SALE_UNAVAILABLE", "Sale is no longer available");
    const customer = await Contact.findOne({
      _id: sale.contactId,
      businessId: req.auth.businessId,
    }).session(session);
    assert(customer, 409, "CUSTOMER_UNAVAILABLE", "Customer not available");
    const year = indiaDate().slice(0, 4);
    const counter = await Counter.findOneAndUpdate(
      { businessId: req.auth.businessId, year },
      { $inc: { value: 1 } },
      { session, new: true, upsert: true },
    );
    invoice.number = `${business.invoicePrefix}-${year}-${String(counter!.value).padStart(5, "0")}`;
    invoice.snapshot = {
      business: {
        name: business.name,
        address: business.address,
        phone: business.phone,
        taxId: business.taxId,
        bankDetails: business.bankDetails,
        upi: business.upi,
      },
      customer: {
        name: customer.name,
        address: customer.address,
        phone: customer.phone ?? "",
      },
      sale: sale.input,
      subtotal: sale.subtotal,
      tax: sale.tax,
      total: sale.total,
      productName: sale.productName ?? "",
    };
    invoice.status = "issued";
    invoice.issuedAt = new Date();
    await invoice.save({ session });
    await Audit.create(
      [
        {
          businessId: req.auth.businessId,
          userId: req.auth.userId,
          action: "ISSUE_INVOICE",
          entityId: invoice._id,
          details: { number: invoice.number },
        },
      ],
      { session },
    );
    return invoice;
  });
  res.json(invoice);
});
invoiceRouter.get("/:id/pdf", async (req, res) => {
  const invoice = await Invoice.findOne({
    _id: id.parse(req.params.id),
    businessId: req.auth.businessId,
  }).lean();
  assert(invoice, 404, "NOT_FOUND", "Invoice not found");
  const buffer = await renderPdf(invoice);
  res
    .set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
      "Cache-Control": "no-store",
    })
    .send(buffer);
});
invoiceRouter.post("/:id/share", async (req, res) => {
  const token = randomBytes(32).toString("hex");
  const invoice = await Invoice.findOneAndUpdate(
    {
      _id: id.parse(req.params.id),
      businessId: req.auth.businessId,
      status: "issued",
    },
    {
      $set: {
        shareHash: hashToken(token),
        shareExpiresAt: new Date(Date.now() + 86400000),
      },
    },
    { new: true },
  );
  assert(invoice, 404, "NOT_FOUND", "Issued invoice not found");
  const sale = await Record.findOne({
    _id: invoice.saleId,
    businessId: req.auth.businessId,
  }).lean();
  const url = `${env.APP_BASE_URL}/share/${token}`;
  const message = `வணக்கம் ${invoice.snapshot?.customer.name},\n${invoice.snapshot?.business.name}\nபில் எண்: ${invoice.number}\nமொத்த தொகை: ${rupees(invoice.snapshot!.total)}\nபாக்கி: ${rupees((sale?.total ?? 0) - (sale?.paid ?? 0))}\nPDF பில்: ${url}\nநன்றி!`;
  res.json({
    url,
    expiresAt: invoice.shareExpiresAt,
    message,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`,
  });
});
invoiceRouter.delete("/:id/share", async (req, res) => {
  await Invoice.updateOne(
    { _id: id.parse(req.params.id), businessId: req.auth.businessId },
    { $unset: { shareHash: 1, shareExpiresAt: 1 } },
  );
  res.sendStatus(204);
});
invoiceRouter.post("/:id/cancel", authorize("owner"), async (req, res) => {
  const { reason } = z
    .object({ reason: z.string().trim().min(5).max(500) })
    .parse(req.body);
  await mongoose.connection.transaction(async (session) => {
    await Business.updateOne(
      { _id: req.auth.businessId },
      { $inc: { mutationVersion: 1 } },
      { session },
    );
    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: id.parse(req.params.id),
        businessId: req.auth.businessId,
        status: { $ne: "cancelled" },
      },
      {
        $set: { status: "cancelled", cancelledAt: new Date() },
        $unset: { shareHash: 1, shareExpiresAt: 1 },
      },
      { session },
    );
    assert(
      invoice,
      409,
      "UNAVAILABLE",
      "Invoice unavailable or already cancelled",
    );
    await Audit.create(
      [
        {
          businessId: req.auth.businessId,
          userId: req.auth.userId,
          action: "CANCEL_INVOICE",
          entityId: invoice._id,
          details: { reason },
        },
      ],
      { session },
    );
  });
  res.sendStatus(204);
});
