import "server-only";
import { getDatabase } from "../../server/db/connection";
import { requirePaymentTestAdmin } from "./access";

export async function listAdminTestPayments(headers: Headers) {
  await requirePaymentTestAdmin(headers);
  const database = await getDatabase();
  const orders = await database.db
    .collection("orders")
    .find(
      { paymentMethod: "ONLINE", testOnly: true },
      {
        sort: { createdAt: -1, _id: -1 },
        limit: 50,
        projection: {
          orderNumber: 1,
          state: 1,
          financialState: 1,
          fulfillmentException: 1,
          createdAt: 1,
          paymentDeadlineAt: 1,
          "snapshots.totals.grandTotalPaise": 1,
        },
      },
    )
    .toArray();
  const ids = orders.map((order) => order._id);
  const [bindings, payments] = await Promise.all([
    database.db
      .collection("paymentBindings")
      .find(
        { orderId: { $in: ids }, active: true },
        {
          projection: {
            orderId: 1,
            state: 1,
            providerOrderId: 1,
            lastErrorCode: 1,
          },
        },
      )
      .toArray(),
    database.db
      .collection("payments")
      .aggregate([
        { $match: { orderId: { $in: ids } } },
        { $sort: { verifiedAt: -1, _id: -1 } },
        {
          $group: {
            _id: "$orderId",
            state: { $first: "$state" },
            method: { $first: "$method" },
            verifiedAt: { $first: "$verifiedAt" },
          },
        },
      ])
      .toArray(),
  ]);
  return orders.map((order) => {
    const binding = bindings.find((item) => item.orderId.equals(order._id));
    const payment = payments.find((item) => item._id.equals(order._id));
    return {
      orderNumber: String(order.orderNumber),
      orderState: String(order.state),
      financialState: String(order.financialState),
      exception: String(order.fulfillmentException ?? "NONE"),
      totalPaise: Number(order.snapshots?.totals?.grandTotalPaise ?? 0),
      createdAt:
        order.createdAt instanceof Date ? order.createdAt.toISOString() : "",
      deadlineAt:
        order.paymentDeadlineAt instanceof Date
          ? order.paymentDeadlineAt.toISOString()
          : null,
      bindingState: binding?.state ?? "MISSING",
      bindingReview: binding?.lastErrorCode ?? null,
      paymentState: payment?.state ?? "NONE",
      paymentMethod: payment?.method ?? null,
      verifiedAt:
        payment?.verifiedAt instanceof Date
          ? payment.verifiedAt.toISOString()
          : null,
    };
  });
}
