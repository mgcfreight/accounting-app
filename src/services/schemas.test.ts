import { describe, expect, it } from "vitest";
import { CreditStatus, PaymentTerms, Permission, SystemRoleId } from "@/lib/enums";
import {
  billingPeriodDetailSchema,
  agreementSchema,
  carrierInvoiceSchema,
  contactSchema,
  customerInvoiceSchema,
  exchangeRateSchema,
  meSchema,
  noticeSettingsSchema,
  permissionCatalogSchema,
  syncEventSchema,
  syncStatusSchema,
  roleSchema,
  userSchema,
} from "./schemas";

// GET /auth/me as mgc-accounts-backend 6d4374d sends it.
const me = {
  id: "usr_VIEWER0001",
  firstName: "Sam",
  lastName: "Lee",
  email: "sam@mgcfreight.com",
  role: { id: SystemRoleId.Viewer, name: "Viewer", isSystem: true },
  isAdmin: false,
  permissions: ["parties.view", "customer_invoices.view"],
  isEnabled: true,
  twoFactorEnabled: true,
  lastLoginAt: "2026-10-24T09:30:00.000Z",
  createdAt: "2026-10-01T09:30:00.000Z",
  updatedAt: "2026-10-01T09:30:00.000Z",
  recoveryCodesRemaining: 9,
  twoFactor: {
    authenticatorSetUp: true,
    canTurnOff: true,
    availableMethods: ["TOTP"],
  },
};

describe("meSchema", () => {
  it("reads the role object, isAdmin and permissions", () => {
    const parsed = meSchema.parse(me);
    expect(parsed.role.id).toBe(SystemRoleId.Viewer);
    expect(parsed.isAdmin).toBe(false);
    expect(parsed.permissions).toEqual([
      Permission.PartiesView,
      Permission.CustomerInvoicesView,
    ]);
  });

  it("drops a permission this build doesn't know instead of failing", () => {
    const parsed = meSchema.parse({
      ...me,
      permissions: ["parties.view", "sync.run"],
    });
    expect(parsed.permissions).toEqual([Permission.PartiesView]);
  });

  it("refuses the old string role", () => {
    expect(meSchema.safeParse({ ...me, role: "Viewer" }).success).toBe(false);
  });

  it("refuses a response without isAdmin", () => {
    const { isAdmin: _isAdmin, ...withoutIsAdmin } = me;
    expect(meSchema.safeParse(withoutIsAdmin).success).toBe(false);
  });
});

describe("userSchema", () => {
  it("reads a user row's role object", () => {
    const {
      isAdmin: _isAdmin,
      permissions: _permissions,
      recoveryCodesRemaining: _codes,
      twoFactor: _twoFactor,
      ...user
    } = me;
    expect(userSchema.parse(user).role.name).toBe("Viewer");
  });
});

describe("contactSchema", () => {
  // GET /party/contacts, one row, as the API's ContactView sends it.
  const contact = {
    id: "pct_AP00000001",
    partyId: "pty_4fK9qZ0aB1",
    name: "Accounts Payable",
    email: "ap@acmefoods.com",
    phone: null,
    receivesInvoices: true,
    receivesReminders: true,
    receivesStatements: false,
    isActive: true,
    createdAt: "2026-10-01T09:30:00.000Z",
    updatedAt: "2026-10-01T09:30:00.000Z",
  };

  it("reads a contact and what it receives", () => {
    const parsed = contactSchema.parse(contact);
    expect(parsed.email).toBe("ap@acmefoods.com");
    expect(parsed.receivesInvoices).toBe(true);
    expect(parsed.phone).toBeNull();
  });

  it("refuses a contact without an email", () => {
    const { email: _email, ...withoutEmail } = contact;
    expect(contactSchema.safeParse(withoutEmail).success).toBe(false);
  });
});

describe("agreementSchema", () => {
  // One of GET /party/:id's agreements, as the API's AgreementView sends it.
  const agreement = {
    id: "pag_AGR0000001",
    partyId: "pty_4fK9qZ0aB1",
    paymentTerms: "NET_90",
    currency: "CAD",
    creditStatus: "ALLOWED",
    creditLimit: "25000.00",
    taxTreatment: "STANDARD",
    taxBasis: "BILL_TO",
    billingTrigger: null,
    noticeDaysBefore: null,
    alertDaysBefore: null,
    defaultAdjustmentMode: "SEPARATE",
    autoSendInvoices: false,
    billingNoticeEnabled: true,
    remindersEnabled: true,
    weeklyStatementEnabled: false,
    effectiveFrom: "2026-11-01",
    effectiveTo: null,
    notes: null,
    createdAt: "2026-11-01T09:30:00.000Z",
  };

  it("reads Net 90 and the credit limit as text", () => {
    const parsed = agreementSchema.parse(agreement);
    expect(parsed.paymentTerms).toBe(PaymentTerms.Net90);
    expect(parsed.creditLimit).toBe("25000.00");
    expect(agreementSchema.parse({ ...agreement, creditLimit: null }).creditLimit).toBeNull();
  });

  it("reads each credit status, null for a carrier, and refuses an unknown one", () => {
    for (const status of [CreditStatus.Allowed, CreditStatus.Blocked, CreditStatus.NotAllowed]) {
      const parsed = agreementSchema.parse({ ...agreement, creditStatus: status, creditLimit: null });
      expect(parsed.creditStatus).toBe(status);
    }
    expect(agreementSchema.parse({ ...agreement, creditStatus: null }).creditStatus).toBeNull();
    expect(agreementSchema.safeParse({ ...agreement, creditStatus: "SUSPENDED" }).success).toBe(false);
  });

  it("refuses a credit limit that isn't a 2-decimal string", () => {
    for (const creditLimit of [25000, "25000", "25000.5", "abc"]) {
      expect(agreementSchema.safeParse({ ...agreement, creditLimit }).success).toBe(false);
    }
  });

  it("reads an agreement from today's API, which sends no credit settings", () => {
    const {
      creditStatus: _creditStatus,
      creditLimit: _creditLimit,
      ...current
    } = agreement;
    const parsed = agreementSchema.parse({ ...current, paymentTerms: "NET_30" });
    expect(parsed.creditStatus).toBeUndefined();
    expect(parsed.creditLimit).toBeUndefined();
  });
});

describe("roleSchema", () => {
  const role = {
    id: "rol_ARCLERK001",
    name: "AR Clerk",
    description: null,
    isSystem: false,
    isAdmin: false,
    permissionsEditable: true,
    permissions: ["parties.view", "customer_invoices.view"],
    userCount: 2,
    createdAt: "2026-10-01T09:30:00.000Z",
    updatedAt: "2026-10-01T09:30:00.000Z",
  };

  it("reads known permissions and has no unknown ones", () => {
    const parsed = roleSchema.parse(role);
    expect(parsed.permissions).toEqual([
      Permission.PartiesView,
      Permission.CustomerInvoicesView,
    ]);
    expect(parsed.unknownPermissions).toEqual([]);
  });

  it("keeps a permission this build doesn't know apart, not dropped", () => {
    const parsed = roleSchema.parse({
      ...role,
      permissions: ["parties.view", "sync.run"],
    });
    expect(parsed.permissions).toEqual([Permission.PartiesView]);
    expect(parsed.unknownPermissions).toEqual(["sync.run"]);
  });
});

describe("permissionCatalogSchema", () => {
  it("keeps known cells and drops unknown ones", () => {
    const parsed = permissionCatalogSchema.parse({
      modules: [
        {
          module: "parties",
          label: "Customers and carriers",
          description: "Parties and their agreed terms",
          actions: [
            { action: "view", label: "View", permission: "parties.view" },
            { action: "archive", label: "Archive", permission: "parties.archive" },
          ],
        },
      ],
      actions: [{ action: "view", label: "View" }],
    });
    expect(parsed.modules[0].actions.map((cell) => cell.permission)).toEqual([
      Permission.PartiesView,
    ]);
  });
});

// GET /invoice/customer as accounting 7898cbe sends it (toCustomerInvoiceView).
const customerInvoice = {
  id: "sin_a1b2c3d4e5",
  tmsInvoiceCode: "EGP9wr",
  sequenceValue: "230",
  suffix: "a",
  kind: "STANDARD",
  shipmentId: "shp_4fK9qZ0aB1",
  agreementId: "agr_4fK9qZ0aB1",
  paymentStatus: "UNPAID",
  currency: "CAD",
  fxRateToCad: null,
  paymentTerms: "NET_30",
  invoiceDate: "2026-10-21",
  dueDate: "2026-11-20",
  taxBasis: "BILL_TO",
  taxJurisdiction: "ON",
  bolNumber: "BOL-88231",
  pickupNumber: null,
  poNumber: null,
  soNumber: null,
  proNumber: null,
  quoteNumber: null,
  billNumber: null,
  subtotal: "1100.00",
  taxes: [
    {
      tax_rate_id: "txr_HSTON00001",
      code: "HST-ON",
      jurisdiction: "ON",
      rate_percent: "13.000",
      taxable_amount: "1100.00",
      tax_amount: "143.00",
    },
  ],
  taxTotal: "143.00",
  total: "1243.00",
  amountPaid: "0.00",
  balanceDue: "1243.00",
  notes: null,
  reviewFlags: [],
  parentInvoiceId: "sin_z9y8x7w6v5",
  revision: 1,
  revisionReason: "Detention at consignee, 2 hours",
  supersededAt: null,
  version: 1,
  createdAt: "2026-10-21T18:05:00.000Z",
  updatedAt: "2026-10-21T18:05:00.000Z",
  lines: [
    {
      id: "sil_a1b2c3d4e5",
      lineNo: 1,
      chargeTypeCode: "LINEHAUL",
      description: "Linehaul Toronto to Montreal",
      quantity: "1.000",
      unitPrice: "1100.0000",
      amount: "1100.00",
      isTaxable: true,
      mgcChargeId: null,
    },
  ],
  invoiceNumber: "sin_EGP9wr_230a",
  customerId: "pty_4fK9qZ0aB1",
  status: "ISSUED",
  billTo: {
    name: "Acme Foods Ltd",
    legal_name: null,
    gst_hst_number: "123456789RT0001",
    address_line1: "100 King St W",
    address_line2: null,
    city: "Toronto",
    province: "ON",
    postal_code: "M5H 1J9",
    country: "CA",
  },
  issuedAt: "2026-10-21T18:10:00.000Z",
  sentAt: null,
};

describe("customerInvoiceSchema", () => {
  it("reads an invoice with its lines, taxes and version fields", () => {
    const parsed = customerInvoiceSchema.parse(customerInvoice);
    expect(parsed.total).toBe("1243.00");
    expect(parsed.taxes[0].tax_amount).toBe("143.00");
    expect(parsed.lines?.[0].unitPrice).toBe("1100.0000");
    expect(parsed.revision).toBe(1);
  });

  it("reads one from a list, which has no lines", () => {
    const { lines: _lines, ...listed } = customerInvoice;
    expect(customerInvoiceSchema.parse(listed).lines).toBeUndefined();
  });

  it("refuses an amount that isn't a 2-decimal string", () => {
    for (const total of [1243, "1243", "1243.0", "1,243.00", null]) {
      expect(
        customerInvoiceSchema.safeParse({ ...customerInvoice, total }).success
      ).toBe(false);
    }
  });

  it("refuses a tax amount that isn't a 2-decimal string", () => {
    const taxes = [{ ...customerInvoice.taxes[0], tax_amount: 143 }];
    expect(
      customerInvoiceSchema.safeParse({ ...customerInvoice, taxes }).success
    ).toBe(false);
  });

  it("refuses a currency it doesn't know", () => {
    expect(
      customerInvoiceSchema.safeParse({ ...customerInvoice, currency: "EUR" })
        .success
    ).toBe(false);
  });

  it("reads a replaced version", () => {
    const parsed = customerInvoiceSchema.parse({
      ...customerInvoice,
      status: "SUPERSEDED",
      supersededAt: "2026-10-22T12:00:00.000Z",
    });
    expect(parsed.status).toBe("SUPERSEDED");
  });
});

describe("carrierInvoiceSchema", () => {
  const {
    invoiceNumber: _number,
    customerId: _customer,
    billTo: _billTo,
    issuedAt: _issued,
    sentAt: _sent,
    ...shared
  } = customerInvoice;
  const expected = {
    ...shared,
    id: "cin_a1b2c3d4e5",
    status: "EXPECTED",
    subtotal: "0.00",
    taxes: [],
    taxTotal: "0.00",
    total: "0.00",
    balanceDue: "0.00",
    invoiceDate: null,
    dueDate: null,
    referenceNumber: "cin_K3pQ7x_230",
    carrierInvoiceNumber: null,
    carrierId: "pty_9xQ2mL0cD3",
    billingTrigger: "ON_DELIVERY_WITH_POD",
    expectedTotal: "900.00",
    varianceAmount: null,
    receivedAt: null,
    approvedAt: null,
    approvedById: null,
    holdReason: null,
  };

  it("reads an invoice still waiting for the carrier's bill", () => {
    const parsed = carrierInvoiceSchema.parse(expected);
    expect(parsed.expectedTotal).toBe("900.00");
    expect(parsed.varianceAmount).toBeNull();
  });

  it("refuses a variance that isn't a 2-decimal string", () => {
    expect(
      carrierInvoiceSchema.safeParse({ ...expected, varianceAmount: "-5" })
        .success
    ).toBe(false);
  });
});

// GET /party/contacts, one item, as the API's ContactView sends it.
const contact = {
  id: "pcn_7hQ2mX9aL1",
  partyId: "pty_4fK9qZ0aB1",
  name: "Accounts Payable",
  email: "ap@acmefoods.com",
  phone: null,
  receivesInvoices: true,
  receivesReminders: true,
  receivesStatements: true,
  isActive: true,
  createdAt: "2026-10-29T15:02:11.000Z",
  updatedAt: "2026-10-29T15:02:11.000Z",
};

describe("contactSchema", () => {
  it("reads a contact without a phone", () => {
    const parsed = contactSchema.parse(contact);
    expect(parsed.phone).toBeNull();
    expect(parsed.receivesStatements).toBe(true);
  });

  it("refuses a contact missing what it receives", () => {
    const { receivesStatements: _statements, ...partial } = contact;
    expect(contactSchema.safeParse(partial).success).toBe(false);
  });
});

// GET /billing-period, as the API's BillingPeriodDetailView sends it.
const billingPeriod = {
  id: "bpd_3kT8wQ1zN5",
  partyId: "pty_4fK9qZ0aB1",
  partyName: "Northwind Distribution",
  paymentTerms: "NET_30",
  currency: "CAD",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  noticeDate: "2026-10-24",
  status: "NOTIFIED",
  notifiedAt: "2026-10-24T12:00:03.000Z",
  statementId: "stm_9pL2xV6cR0",
  invoiceCount: 2,
  total: "2610.00",
  balanceDue: "1130.00",
  invoices: [
    {
      id: "cin_8cR1tY4uI7",
      invoiceNumber: "sin_EGP9wr_230",
      kind: "STANDARD",
      status: "ISSUED",
      invoiceDate: "2026-10-03",
      dueDate: "2026-11-02",
      total: "1480.00",
      balanceDue: "0.00",
      paymentStatus: "PAID",
    },
    {
      id: "cin_2vB7nM5kJ3",
      invoiceNumber: null,
      kind: "STANDARD",
      status: "ISSUED",
      invoiceDate: "2026-10-14",
      dueDate: null,
      total: "1130.00",
      balanceDue: "1130.00",
      paymentStatus: "UNPAID",
    },
  ],
};

describe("billingPeriodDetailSchema", () => {
  it("reads a period with its invoices", () => {
    const parsed = billingPeriodDetailSchema.parse(billingPeriod);
    expect(parsed.balanceDue).toBe("1130.00");
    expect(parsed.invoices[1].invoiceNumber).toBeNull();
  });

  it("refuses a total that isn't a 2-decimal string", () => {
    expect(
      billingPeriodDetailSchema.safeParse({ ...billingPeriod, total: 2610 }).success
    ).toBe(false);
  });
});

// GET /exchange-rate/all, one Saturday row; the values are a stored row
// from a local Accounts API database.
const saturdayRate = {
  date: "2026-10-31",
  currency: "USD",
  rateToCad: "1.396000",
  observedOn: "2026-10-30",
  source: "BANK_OF_CANADA",
  fetchedAt: "2026-10-31T21:30:02.000Z",
};

describe("exchangeRateSchema", () => {
  it("keeps the rate as text, exactly as sent", () => {
    const parsed = exchangeRateSchema.parse(saturdayRate);
    expect(parsed.rateToCad).toBe("1.396000");
    expect(parsed.observedOn).toBe("2026-10-30");
  });

  it("refuses a rate sent as a number", () => {
    expect(
      exchangeRateSchema.safeParse({ ...saturdayRate, rateToCad: 1.3912 }).success
    ).toBe(false);
  });
});

// GET /sync/status as mgc-accounts-backend sends it.
const syncStatus = {
  enabled: true,
  running: false,
  cursor: "1043:2058",
  cursorUpdatedAt: "2026-10-26T15:02:11.000Z",
  inbox: { RECEIVED: 0, APPLIED: 2050, SKIPPED: 2, FAILED: 6 },
  outbox: { pending: 0, rejected: 0 },
  lastRun: {
    trigger: "MANUAL",
    startedAt: "2026-10-26T15:02:10.000Z",
    finishedAt: "2026-10-26T15:02:11.000Z",
    pulled: 1,
    applied: 1,
    failed: 0,
    skipped: 0,
    error: null,
  },
};

describe("syncStatusSchema", () => {
  it("reads the counts and the last run", () => {
    const parsed = syncStatusSchema.parse(syncStatus);
    expect(parsed.inbox.FAILED).toBe(6);
    expect(parsed.lastRun?.applied).toBe(1);
  });

  it("reads a server that hasn't run yet", () => {
    expect(
      syncStatusSchema.parse({ ...syncStatus, lastRun: null }).lastRun
    ).toBeNull();
  });

  it("refuses a cursor that isn't txId:seq", () => {
    expect(
      syncStatusSchema.safeParse({ ...syncStatus, cursor: "2058" }).success
    ).toBe(false);
  });

  it("refuses a missing count rather than showing 0", () => {
    const { FAILED: _failed, ...inbox } = syncStatus.inbox;
    expect(syncStatusSchema.safeParse({ ...syncStatus, inbox }).success).toBe(
      false
    );
  });
});

describe("syncEventSchema", () => {
  const held = {
    eventId: "0d6c5a52-6f2e-4c1a-9a43-0d6b1fb1f0a1",
    seq: "938",
    type: "shipment.upserted",
    aggregateId: "6650",
    status: "FAILED",
    error: "No Accounts payment terms for a 90-day credit period",
    attempts: 3,
    occurredAt: "2026-10-26T14:00:00.000Z",
    receivedAt: "2026-10-26T14:01:00.000Z",
    appliedAt: null,
  };

  it("reads a held event with its reason", () => {
    expect(syncEventSchema.parse(held).error).toContain("90-day");
  });

  it("refuses a status it doesn't know", () => {
    expect(syncEventSchema.safeParse({ ...held, status: "DONE" }).success).toBe(
      false
    );
  });
});

describe("noticeSettingsSchema", () => {
  // GET /settings/notices as the API sends it once it takes Net 90 (#29).
  const notices = {
    defaultNoticeDays: { NET_7: 2, NET_15: 4, NET_30: 7, NET_60: 7, NET_90: 7 },
    carrierAlertDaysBefore: null,
    updatedAt: null,
    updatedBy: null,
  };

  it("reads Net 90's notice days", () => {
    expect(noticeSettingsSchema.parse(notices).defaultNoticeDays.NET_90).toBe(7);
  });

  it("refuses notice days without Net 90 or out of range", () => {
    const { NET_90: _net90, ...withoutNet90 } = notices.defaultNoticeDays;
    for (const defaultNoticeDays of [
      withoutNet90,
      { ...notices.defaultNoticeDays, NET_90: 31 },
      { ...notices.defaultNoticeDays, NET_90: "7" },
    ]) {
      expect(noticeSettingsSchema.safeParse({ ...notices, defaultNoticeDays }).success).toBe(false);
    }
  });
});
