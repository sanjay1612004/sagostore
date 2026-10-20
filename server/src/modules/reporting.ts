import mongoose from "mongoose";
import { indiaDate, rupees } from "@tamiltrade/shared";
import { Record, Product, Contact } from "./models.js";
import { recordView } from "./trading.js";
export async function salesSummary(
  businessId: string,
  filters: {
    date?: string;
    from?: string;
    to?: string;
    contactId?: string;
    productId?: string;
  } = {},
) {
  const date = filters.date ?? (!filters.from && !filters.to ? indiaDate() : undefined);
  const [summary] = await Record.aggregate<{ total: number; count: number }>([
    { $match: {
      businessId: new mongoose.Types.ObjectId(businessId),
      status: "posted",
      kind: "sale",
      ...(date ? { date } : { date: {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      } }),
      ...(filters.contactId ? { contactId: new mongoose.Types.ObjectId(filters.contactId) } : {}),
      ...(filters.productId ? { productId: new mongoose.Types.ObjectId(filters.productId) } : {}),
    } },
    { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
  ]);
  const total = summary?.total ?? 0;
  const count = summary?.count ?? 0;
  const period = date
    ? date === indiaDate() ? "Today’s sales" : `Sales on ${date}`
    : filters.from && filters.to ? `Sales from ${filters.from} to ${filters.to}`
      : filters.from ? `Sales from ${filters.from}` : `Sales through ${filters.to}`;
  return {
    salesTotal: total,
    salesCount: count,
    date,
    from: date ?? filters.from,
    to: date ?? filters.to,
    text: `${period}: ${rupees(total)} across ${count} sale${count === 1 ? "" : "s"} (including tax).`,
  };
}
export async function dashboard(businessId: string) {
  const today = indiaDate();
  const month = today.slice(0, 7);
  const bid = new mongoose.Types.ObjectId(businessId);
  const [summary, trend, recent, stock, overdue] = await Promise.all([
    Record.aggregate([
      { $match: { businessId: bid, status: "posted" } },
      {
        $group: {
          _id: null,
          todaySales: {
            $sum: {
              $cond: [
                {
                  $and: [{ $eq: ["$kind", "sale"] }, { $eq: ["$date", today] }],
                },
                "$total",
                0,
              ],
            },
          },
          todayPurchases: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$kind", "purchase"] },
                    { $eq: ["$date", today] },
                  ],
                },
                "$total",
                0,
              ],
            },
          },
          paymentsReceived: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$kind", "customer_payment"] },
                    { $eq: ["$date", today] },
                  ],
                },
                "$total",
                0,
              ],
            },
          },
          receivables: {
            $sum: {
              $cond: [
                { $eq: ["$kind", "sale"] },
                { $subtract: ["$total", "$paid"] },
                0,
              ],
            },
          },
          payables: {
            $sum: {
              $cond: [
                { $eq: ["$kind", "purchase"] },
                { $subtract: ["$total", "$paid"] },
                0,
              ],
            },
          },
          monthlyRevenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$kind", "sale"] },
                    { $eq: [{ $substrBytes: ["$date", 0, 7] }, month] },
                  ],
                },
                { $subtract: ["$total", "$tax"] },
                0,
              ],
            },
          },
          grossProfit: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$kind", "sale"] },
                    { $eq: [{ $substrBytes: ["$date", 0, 7] }, month] },
                  ],
                },
                { $subtract: [{ $subtract: ["$total", "$tax"] }, "$cost"] },
                0,
              ],
            },
          },
          operatingExpenses: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$kind", "expense"] },
                    { $eq: [{ $substrBytes: ["$date", 0, 7] }, month] },
                  ],
                },
                "$total",
                0,
              ],
            },
          },
        },
      },
    ]),
    Record.aggregate([
      {
        $match: {
          businessId: bid,
          status: "posted",
          date: { $gte: month + "-01", $lte: today },
          kind: { $in: ["sale", "purchase"] },
        },
      },
      {
        $group: {
          _id: "$date",
          sales: { $sum: { $cond: [{ $eq: ["$kind", "sale"] }, "$total", 0] } },
          purchases: {
            $sum: { $cond: [{ $eq: ["$kind", "purchase"] }, "$total", 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", sales: 1, purchases: 1 } },
    ]),
    Record.find({ businessId }).sort({ createdAt: -1 }).limit(8).lean(),
    Record.aggregate([
      {
        $match: {
          businessId: bid,
          kind: "purchase",
          status: "posted",
          delivery: "warehouse",
        },
      },
      {
        $group: {
          _id: null,
          quantity: {
            $sum: { $subtract: ["$quantity", "$allocatedQuantity"] },
          },
        },
      },
    ]),
    Record.aggregate([
      {
        $match: {
          businessId: bid,
          kind: "sale",
          status: "posted",
          dueDate: { $lt: today },
          $expr: { $gt: ["$total", "$paid"] },
        },
      },
      { $group: { _id: "$contactId" } },
    ]),
  ]);
  const base = {
    todaySales: 0,
    todayPurchases: 0,
    paymentsReceived: 0,
    receivables: 0,
    payables: 0,
    monthlyRevenue: 0,
    grossProfit: 0,
    operatingExpenses: 0,
    ...summary[0],
  };
  delete base._id;
  return {
    ...base,
    stock: stock[0]?.quantity ?? 0,
    monthlyProfit: base.grossProfit - base.operatingExpenses,
    trend,
    recent: recent.map(recordView),
    insights: [
      ...(overdue.length
        ? [`${overdue.length} customers have overdue payments.`]
        : []),
      ...(stock[0]?.quantity === 0
        ? ["Your warehouse has no available stock."]
        : []),
    ],
  };
}
export async function inventory(
  businessId: string,
  page: number,
  limit: number,
  productId?: string,
) {
  const filter = {
    businessId,
    kind: "purchase",
    status: "posted",
    ...(productId ? { productId } : {}),
  };
  const [lots, total] = await Promise.all([
    Record.find(filter)
      .sort({ date: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Record.countDocuments(filter),
  ]);
  return {
    items: lots.map((l) => ({
      ...recordView(l),
      availableQuantity: l.quantity - l.allocatedQuantity,
      warehouseQuantity:
        l.delivery === "warehouse" ? l.quantity - l.allocatedQuantity : 0,
    })),
    total,
    page,
    limit,
  };
}
export async function priceHistory(
  businessId: string,
  productId?: string,
  supplierId?: string,
) {
  const rows = await Record.find({
    businessId,
    kind: "purchase",
    status: "posted",
    ...(productId ? { productId } : {}),
    ...(supplierId ? { contactId: supplierId } : {}),
  })
    .sort({ date: -1 })
    .limit(200)
    .lean();
  return rows.map((r) => ({
    id: r._id,
    supplier: r.contactName,
    product: r.productName,
    productId: r.productId,
    date: r.date,
    unitPrice: r.input.unitPrice,
    landedCostPerUnitPaise: Math.round(r.cost / r.quantity),
    quantity: r.quantity,
    unit: "configured product unit",
  }));
}
export async function contactsWithBalances(
  businessId: string,
  kind: string,
  search: string,
  page: number,
  limit: number,
) {
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = {
    businessId,
    kind,
    ...(search ? { name: { $regex: escaped, $options: "i" } } : {}),
  };
  const [contacts, total] = await Promise.all([
    Contact.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Contact.countDocuments(filter),
  ]);
  const balances = await Record.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(businessId),
        status: "posted",
        contactId: { $in: contacts.map((c) => c._id) },
      },
    },
    {
      $group: {
        _id: "$contactId",
        balance: {
          $sum: {
            $cond: [
              { $in: ["$kind", ["purchase", "sale"]] },
              "$total",
              { $multiply: ["$total", -1] },
            ],
          },
        },
      },
    },
  ]);
  const map = new Map(balances.map((b) => [String(b._id), b.balance]));
  return {
    items: contacts.map((c) => ({
      ...c,
      balance: map.get(String(c._id)) ?? 0,
    })),
    total,
    page,
    limit,
  };
}
export async function productStock(businessId: string) {
  return Product.aggregate([
    { $match: { businessId: new mongoose.Types.ObjectId(businessId) } },
    {
      $lookup: {
        from: "records",
        let: { pid: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$productId", "$$pid"] },
                  {
                    $eq: [
                      "$businessId",
                      new mongoose.Types.ObjectId(businessId),
                    ],
                  },
                  { $eq: ["$kind", "purchase"] },
                  { $eq: ["$status", "posted"] },
                  { $eq: ["$delivery", "warehouse"] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              available: {
                $sum: { $subtract: ["$quantity", "$allocatedQuantity"] },
              },
            },
          },
        ],
        as: "stock",
      },
    },
    {
      $addFields: {
        available: { $ifNull: [{ $arrayElemAt: ["$stock.available", 0] }, 0] },
      },
    },
    { $project: { stock: 0 } },
  ]);
}
