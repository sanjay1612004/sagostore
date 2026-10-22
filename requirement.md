# ULTIMATE MASTER PROMPT
# TAMILTRADE AI — NEXT-GENERATION TAMIL VOICE BUSINESS ASSISTANT

## ROLE AND EXPECTATIONS

Act as a senior full-stack mobile engineer, senior UI/UX designer, AI engineer, MongoDB architect, cloud infrastructure engineer, and software security specialist.

Build a complete, functional, production-oriented Android and iOS mobile application called **TamilTrade AI**.

Deliver an exceptionally polished, ultra-modern mobile experience comparable in quality and attention to detail to premium financial technology products.

The application must be genuinely functional from mobile interface to database to deployed backend.

Do not build a superficial demonstration containing fake data, disconnected screens, non-working buttons, or unfinished API placeholders.

Implement actual workflows, persistent records, financial calculations, Tamil speech recognition, business operations, and real cloud deployment.

The development process must be incremental, with each phase implemented and tested before proceeding.

---

# 1. PRODUCT IDENTITY

## Application Name

**TamilTrade AI**

## Tagline

**"பேசுங்க... பிசினஸை நாங்க பாத்துக்குறோம்!"**

English: "Speak naturally. Run your business smarter."

## Initial Business

**SAI GANESH STORE**

Business type: Sago (ஜவ்வரிசி) trading and wholesale distribution.

The owner purchases sago from mills and resells it to wholesale buyers, shops, merchants, and individual customers.

The business may operate using either:

- Direct mill-to-customer delivery.
- Purchase into its own warehouse followed by resale.
- A combination of both.

The app must support all three workflows.

## Long-Term Product Vision

Build the application initially for one real business, but make its architecture reusable for other wholesale businesses:

- Sago traders
- Rice traders
- Textile traders
- Wholesale distributors
- Food-product suppliers
- Agricultural commodity merchants
- General trading businesses

Do not hardcode "Sago" into core financial database relationships.

Support configurable business types, product categories, quantities, units, tax settings, and terminology.

---

# 2. STRICT TECHNOLOGY STACK

Use only the following primary stack.

## Native Mobile Frontend

- React Native
- Expo
- TypeScript
- Expo Router
- React Native Reanimated
- React Native Gesture Handler
- React Native Skia for selective advanced visual effects
- NativeWind or an equivalent consistent styling system
- React Native SVG
- Lucide-compatible icons
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Expo Audio
- Expo FileSystem
- Expo Sharing
- Expo SecureStore
- Expo Notifications
- React Native-compatible charting library

Check current Expo SDK compatibility before choosing exact dependency versions.

Use custom development builds where a required native module is not available in Expo Go.

## Backend

- Node.js current supported LTS
- Express.js
- TypeScript
- Mongoose
- Zod
- JWT authentication
- Argon2id password hashing
- Pino logging
- Helmet
- API rate limiting
- Secure multipart audio uploads
- Server-side PDF generation
- Background job processing where required

## Cloud Database

**MongoDB Atlas Free Cluster (M0).**

Do not use local MongoDB as the production database.

Local development should connect to a separate development database or project.

## Cloud Backend Hosting

**Oracle Cloud Infrastructure Always Free — Ampere A1 ARM64 VM.**

Host:

- Express API
- Voice job worker
- Tamil speech-recognition engine
- PDF generation
- Scheduled business reminders
- Application health endpoints

Do not use Render, Railway, or Vercel as the primary backend deployment.

Do not require an always-paid cloud service for the initial application.

## Tamil Speech Recognition

Use **whisper.cpp**, running a multilingual Whisper model on CPU.

Start with a CPU-friendly quantized Base or Small model and compare accuracy against real Tamil recordings.

Support ARM64 compilation for Oracle Ampere processors and local CPU development.

Do not use an English-only Whisper model.

Do not depend on a mandatory paid speech-to-text API.

## AI Command Understanding

Use TypeScript-based command interpretation:

- Intent recognition
- Tamil number normalization
- Rule-based extraction
- Phrase matching
- Entity recognition
- Fuzzy customer/supplier matching
- Conversation context
- Structured command validation

An optional local small language model may be introduced later, but the core trading application must work without it.

## Forbidden Technology Substitutions

Do not replace the requested stack with:

- ASP.NET Core
- C#
- PostgreSQL
- Firebase as the primary database
- Python FastAPI
- React web as the primary mobile UI
- Paid AI APIs as mandatory dependencies

---

# 3. ULTRA-PREMIUM UI/UX DESIGN SYSTEM

This is a critical product requirement.

The application must have an exceptionally modern, visually striking, premium mobile interface.

Do not create an ordinary admin-panel design, generic Bootstrap appearance, or old-fashioned billing application.

Take visual inspiration from the design quality of Linear, Stripe, Revolut, modern Apple applications, and premium AI interfaces.

Do not copy their branding or screen layouts.

Create an original design identity.

## Overall Art Direction

**Luxury Fintech + Modern AI Assistant + Premium Native Mobile UI**

The interface must combine:

- Elegant modern typography
- Precise spacing
- Premium financial cards
- Deep dark surfaces
- Tasteful gradients
- Ultra-smooth native interactions
- Sophisticated data visualizations
- Refined microanimations
- Beautiful Tamil language support
- Strong visual hierarchy

The interface must feel deliberately designed, not assembled from generic templates.

## Color System

### Premium Dark Mode

Primary background: `#080D13`

Secondary background: `#111923`

Elevated surface: `#18232D`

Primary emerald: `#21D6A4`

Muted emerald: `#0E7965`

Primary text: `#F7FAFC`

Secondary text: `#9AADB9`

Warning: `#F5B942`

Danger: `#F16E75`

Borders: Subtle translucent cool-gray.

### Premium Light Mode

Background: `#F5F8F7`

Surface: `#FFFFFF`

Primary text: `#14232A`

Accent: `#087F67`

Secondary text: `#687C84`

Use tasteful tonal gradients rather than excessive neon effects.

Support both themes, with a first-launch preference for the premium dark appearance.

## Typography

Use a refined modern Latin typeface and a high-quality Tamil-compatible typeface.

Typography must support:

- Tamil Unicode
- English
- Currency values
- Mixed Tamil and English text
- Large financial figures
- Clear form labels

Use fonts only with appropriate distribution licenses.

Create a consistent typography scale.

## Component Styling

Create reusable polished components:

- PremiumBalanceCard
- FinancialMetricCard
- GlassSurfaceCard
- VoiceMicrophoneButton
- AITranscriptBubble
- ConfirmationSheet
- AnimatedNumber
- GradientActionButton
- TransactionRow
- PaymentStatusChip
- FilterBottomSheet
- EmptyState
- LoadingSkeleton
- PremiumSearchBar
- FloatingActionButton
- AnimatedProgressRing
- ModernDatePicker
- FinancialChartCard
- CustomToast
- ConfirmationModal

Avoid clutter and unnecessary visual decoration.

## Animations

Use React Native Reanimated for performant native animations.

Implement:

- Smooth screen transitions
- Animated bottom navigation
- Microphone breathing effect
- Audio waveform visualization
- Confirmation-card entrance
- Number transitions
- Smooth chart loading
- Bottom-sheet transitions
- Pull-to-refresh
- Refined press feedback
- Skeleton-loading transitions
- Subtle success animation

Target smooth performance on mid-range Android devices.

Keep essential business workflows fast, readable, and accessible.

Respect reduced-motion settings.

Avoid heavy 3D effects or continuously running animations that waste battery or increase CPU usage.

## Ultra-Premium Voice Assistant UI

The voice assistant should be the visual highlight of the application.

Create a large central microphone orb with:

- Tasteful emerald glow
- Subtle concentric rings
- Live audio waveform
- Animated listening state
- Smooth processing animation
- Distinct ready-to-confirm state
- Haptic feedback
- Cancel recording gesture or button

Display Tamil text naturally.

Example greeting:

"வணக்கம்! இன்னைக்கு என்ன கணக்கு போடலாம்?"

Provide beautiful, tap-to-use suggested commands below the voice orb.

## Responsive Native Layout

Optimize for:

- Android phones
- Small Android screens
- Large-screen Android phones
- iPhone devices
- Safe areas
- Screen rotation where appropriate
- Different font sizes
- Tamil text expansion

Use comfortable touch targets.

Do not stretch a web dashboard into a mobile application.

---

# 4. NAVIGATION AND INFORMATION ARCHITECTURE

Create a custom bottom navigation bar with five primary tabs:

1. Home
2. Transactions
3. AI Voice
4. Customers
5. More

Make the AI Voice action visually prominent in the center.

## Home

Financial overview, charts, alerts and quick actions.

## Transactions

Purchases, sales, expenses and transaction history.

## AI Voice

Tamil voice assistant, transcript history and conversation interface.

## Customers

Customers, balances, invoices, purchase history and ledgers.

## More

- Suppliers
- Inventory
- Payments
- Profit Analytics
- Mill Price History
- Invoices
- Reports
- Settings
- Business Profile
- Staff Management

Use native stack navigation, bottom sheets and contextual screens.

---

# 5. AUTHENTICATION AND USER MANAGEMENT

Implement:

- Secure owner login
- Staff login
- Password hashing
- Access tokens
- Refresh sessions
- Secure device storage
- Logout
- Expired-session handling
- Device/session revocation
- Password recovery workflow
- Optional biometric app unlocking

## Roles

Owner:

Full business management access.

Staff:

Permission-based access to purchases, sales, invoices, and payments.

Use server-side authorization.

Never trust frontend role checks alone.

Support business-specific data isolation.

---

# 6. PREMIUM HOME DASHBOARD

Display live business information using MongoDB records.

## Summary Cards

- Today's Sales
- Today's Purchases
- Payments Received
- Customer Outstanding
- Supplier Payables
- Stock Quantity
- Estimated Monthly Profit

## Visualizations

Build premium animated charts for:

- Daily sales trend
- Weekly sales
- Monthly revenue
- Purchases vs sales
- Profit trends
- Customer payments
- Supplier purchase distribution

Use genuine backend data.

## Recent Activity

Show a chronological timeline:

- New purchase
- Sale completed
- Payment recorded
- Invoice generated
- Stock received
- Payment overdue

## Smart Insights

Provide insights such as:

"3 customers have overdue payments."

"ABC Mill supplied the highest quantity this month."

"Transport cost increased compared with last month."

Generate these insights deterministically from available records.

Do not fabricate information.

---

# 7. TAMIL VOICE ASSISTANT ENGINE

Implement complete voice-to-business-action functionality.

## Voice Input Pipeline

Mobile microphone
→ Audio recording
→ Secure HTTPS upload
→ Express API
→ Voice processing job
→ whisper.cpp transcription
→ Tamil text normalization
→ Intent classification
→ Entity extraction
→ Database entity matching
→ Missing-field detection
→ Editable preview
→ User confirmation
→ Business service
→ MongoDB transaction
→ Tamil result

## Voice States

- Idle
- Listening
- Recording
- Uploading
- Transcribing
- Understanding
- Clarification Required
- Confirmation Required
- Saving
- Completed
- Error

Provide visible feedback for each stage.

Avoid pretending the AI has completed a transaction while it is still processing.

## Speech Support

Recognize:

- Spoken Tamil
- Colloquial Tamil
- Tamil-English code switching
- Tanglish business terminology
- Tamil number words
- English numbers
- Customer names
- Supplier names
- Product names
- Price expressions
- Dates
- Correction statements

## Example

User:

"இன்னைக்கு ABC மில்லுல இருந்து 50 மூட்டை ஜவ்வரிசி வாங்கினேன். ஒரு மூட்டை 3200 ரூபாய். லாரி வாடகை 2500."

Extract:

Action: CREATE_PURCHASE

Supplier: ABC Mill

Quantity: 50 bags

Unit price: ₹3,200

Purchase subtotal: ₹1,60,000

Transport: ₹2,500

Landed cost: ₹1,62,500

Show a premium confirmation card.

User must confirm before saving.

---

# 8. VOICE UNDERSTANDING WITHOUT PAID LLMs

Build a dedicated TypeScript natural-language processing module.

## Intent Types

CREATE_PURCHASE

CREATE_SALE

CREATE_EXPENSE

RECORD_CUSTOMER_PAYMENT

RECORD_SUPPLIER_PAYMENT

GET_CUSTOMER_BALANCE

GET_SUPPLIER_BALANCE

GET_STOCK

GET_PROFIT

GET_DAILY_SALES

GET_MONTHLY_REPORT

GET_PRICE_HISTORY

CREATE_INVOICE_DRAFT

SHARE_INVOICE

UPDATE_PENDING_DRAFT

CANCEL_PENDING_ACTION

GET_PURCHASE_HISTORY

GET_CUSTOMER_HISTORY

## Tamil Number Normalization

Recognize:

"ஐம்பது" → 50

"இருபதாயிரம்" → 20,000

"ஒரு லட்சம்" → 100,000

"ஒன்றரை லட்சம்" → 150,000

"ரெண்டாயிரத்து ஐநூறு" → 2,500

Handle spoken and colloquial variants.

Do not assume unclear numbers.

## Name Recognition

Support supplier/customer aliases.

Example:

"ABC Mill"

"ஏபிசி மில்"

"ABC மில்லு"

These may refer to one registered supplier.

Use normalized aliases and fuzzy matching.

If multiple matches are possible, display a selection prompt.

Never select a financially relevant account using an uncertain match without confirmation.

## Clarification

User:

"20 மூட்டை 3000 ரூபாய்க்கு வாங்கினேன்."

Assistant:

"ஒரு மூட்டை ₹3,000 ஆ? இல்ல மொத்தம் ₹3,000 ஆ?"

Do not assume the price unit.

---

# 9. MULTI-TURN AI CONVERSATIONS

Support context-aware interactions.

Example:

User:

"ரமேஷ் பாக்கி எவ்வளவு?"

Assistant:

"ரமேஷ் கடையிலிருந்து ₹40,000 வரவேண்டியுள்ளது."

User:

"அதுல 10 ஆயிரம் கொடுத்தார்."

Assistant:

"ரமேஷ் கடையிலிருந்து ₹10,000 பணம் பெற்றதாக பதிவு செய்யவா?"

User:

"ஆமா."

After successful confirmation, save the payment once.

## Correction Example

User:

"50 மூட்டை வாங்கினேன்."

Then:

"இல்ல, 60 மூட்டை."

Update the pending draft.

Recalculate totals and request confirmation again.

Do not silently change previously completed financial records.

Maintain conversation context in a structured, expiring session.

Never use previous conversation text as authority to execute an unrelated financial operation.

---

# 10. MILL PURCHASE MANAGEMENT

Implement:

- Add purchase
- Voice purchase entry
- Supplier selection
- Purchase date
- Sago variety
- Bags
- Weight per bag
- Quantity in kilograms
- Purchase rate
- Rate unit
- Transport charges
- Loading charges
- Unloading charges
- Other expenses
- Supplier invoice reference
- Lot number
- Payment status
- Direct delivery or warehouse receipt
- Purchase history
- Purchase corrections
- Supplier ledger updates

Calculate landed costs on the backend.

Store all monetary values using a consistent decimal-safe strategy.

Do not use binary floating-point calculations as the authoritative accounting result.

---

# 11. INVENTORY MANAGEMENT

Support real stock movements.

## Features

- Product-wise stock
- Mill-wise stock
- Lot-wise stock
- Bags and kilograms
- Weight per bag
- Available quantity
- Reserved quantity, when applicable
- Received stock
- Sold stock
- Returns
- Damage adjustments
- Low-stock alerts
- Inventory history

## Direct Mill-to-Customer Sales

When goods are dispatched directly from the mill to a customer, record the linked purchase and sale without incorrectly increasing warehouse stock.

## Stock-Owned Sales

When goods are sold from owned inventory, use an auditable inventory movement and record the source lot.

Prevent double stock deductions.

---

# 12. CUSTOMER SALES MANAGEMENT

Implement:

- Create sale
- Tamil voice sales entry
- Select customer
- Product selection
- Quantity
- Selling rate
- Discount
- Transport charges billed to customer
- Delivery information
- Related stock lot or direct purchase
- Tax details when applicable
- Payment terms
- Partial payment status
- Sales history
- Customer history

## Voice Example

"ரமேஷ் கடைக்கு 20 மூட்டை வித்தேன். ஒரு மூட்டை 3500 ரூபாய். இன்னும் காசு தரல."

Expected sale subtotal: ₹70,000.

Create a confirmation preview and save after approval.

Update customer receivables and linked inventory appropriately.

---

# 13. CUSTOMER AND SUPPLIER CREDIT MANAGEMENT

Create distinct accounting views.

## Customer Receivables

Money customers owe the business.

## Supplier Payables

Money the business owes mills.

## Features

- Pending balances
- Partial payments
- Full payments
- Advance payments, if configured
- Due dates
- Payment terms
- Overdue status
- Credit limits
- Customer statements
- Supplier statements
- Collection history
- Payment reminders

## Voice Commands

"ரமேஷ் எவ்வளவு பாக்கி?"

"ABC மில்லுக்கு எவ்வளவு கொடுக்கணும்?"

"இன்னைக்கு யார் பணம் கொடுத்தாங்க?"

"ரமேஷ் 20 ஆயிரம் GPay பண்ணிட்டார்."

Record payments only after resolving the correct customer or supplier and any necessary invoice allocation.

Implement idempotency to prevent duplicate payments.

---

# 14. REAL PROFIT CALCULATOR

Calculate business profitability from genuine records.

## Include

- Purchase price
- Supplier discounts
- Transport
- Loading
- Unloading
- Associated expenses
- Sales revenue
- Sales discounts
- Returns
- Cost of goods sold
- Operating expenses

## Reports

- Profit per transaction
- Daily profit
- Weekly profit
- Monthly profit
- Customer-wise profit
- Supplier-wise purchase analysis
- Product-wise profit
- Lot-wise profitability
- Overall business performance

Support an explicit stock valuation strategy.

Distinguish cash flow from profit.

Avoid double-counting expenses.

If data is incomplete, mark results as estimates.

---

# 15. EXPENSE MANAGEMENT

Allow voice and manual entry.

Supported categories:

- Transport
- Loading
- Unloading
- Fuel
- Labour
- Commission
- Rent
- Miscellaneous

Voice example:

"இன்னைக்கு லாரிக்கு 2500 ரூபாய் கொடுத்தேன்."

Recognize the expense amount, category, date and possible related transaction.

Ask for confirmation before saving.

---

# 16. PREMIUM INVOICE GENERATOR

Build an elegant invoice creation experience.

## Invoice Fields

- Seller details
- Customer details
- Invoice number
- Invoice date
- Product details
- Quantity
- Units
- Rate
- Discounts
- Tax details
- Total
- Payment due date
- Bank details
- UPI details
- Notes and terms

## Invoice Design

Create beautifully formatted A4 PDFs with:

- Professional business header
- Logo
- Clear invoice type
- Precise product table
- Premium but printer-friendly styling
- Amount in words
- Payment information
- Tamil Unicode support
- Multi-page support

Issue invoice numbers atomically.

Preserve issued invoice snapshots.

Do not silently modify finalized invoices.

Provide cancellation, reversal or credit-note workflows where required.

## Tax Requirements

Do not hardcode GST rates or HSN classifications for sago.

Support appropriate invoice types and configurable tax treatment.

Use legally required fields when applicable.

Tax rules and actual production invoices must be reviewed for current compliance.

---

# 17. WHATSAPP BILL SHARING

Provide both PDF sharing and message sharing.

## Native PDF Sharing

1. Generate PDF on the backend.
2. Download authorized PDF to mobile app cache.
3. Open the operating system's native sharing sheet.
4. Allow user to choose WhatsApp when supported.
5. Let user manually send the document.

## WhatsApp Message Sharing

Generate:

"வணக்கம் ரமேஷ்,

SAI GANESH STORE பில் விவரங்கள்:

பில் எண்: SG-001

மொத்த தொகை: ₹70,000

பாக்கி: ₹30,000

PDF பில்: {SecureLink}

நன்றி!"

Use a properly encoded WhatsApp click-to-chat URL.

Do not claim the PDF is automatically attached through a text link.

Do not claim that opening WhatsApp confirms delivery.

## Invoice Security

- Authorized PDF generation
- Cryptographically secure invoice links
- Expiring share tokens
- Token revocation
- No publicly predictable invoice URLs

---

# 18. MILL PRICE HISTORY AND COMPARISON

Implement:

- Supplier quotations
- Historical purchase prices
- Product-wise pricing
- Date-wise comparison
- Transport-adjusted purchase cost
- Price increase/decrease indicators
- Trend charts
- Cheapest recorded mill
- Quotation expiry dates

Voice examples:

"ABC மில்லுல கடைசி ரேட் என்ன?"

"இந்த மாசம் எந்த மில்லுல குறைந்த விலை?"

"கடந்த வாரத்தை விட ரேட் அதிகமா?"

Use actual quotations and purchase records.

Never invent market rates.

Clearly distinguish historical rates from currently valid quotations.

---

# 19. ADVANCED CUSTOMER AND TRADING INSIGHTS

Add useful insights without mandatory paid AI.

## Buyer Reorder Insights

Track repeat customers and past buying intervals.

Example:

"Ramesh Store usually orders every 15–20 days."

Display this as a historical observation, not a guaranteed prediction.

## Customer Sales Trends

Show:

- Frequently purchased products
- Average order quantity
- Previous selling prices
- Customer purchase frequency
- Outstanding balances

## Supplier Comparison

Compare:

- Price
- Transport-adjusted cost
- Delivery history
- Recorded quality complaints
- Available quotations

Do not automatically rate supplier quality without supporting records.

---

# 20. TAMIL VOICE RESPONSES

Support assistant speech output where compatible Tamil TTS is available.

Example:

User:

"இன்னைக்கு எவ்வளவு விற்பனை?"

Assistant:

"இன்னைக்கு மொத்த விற்பனை எண்பத்தி ஐந்தாயிரம் ரூபாய்."

Always display text as well.

Provide a voice-output enable/disable option.

If the device lacks suitable Tamil TTS support, show text rather than using unreliable pronunciation.

---

# 21. MONGODB ATLAS DATABASE ARCHITECTURE

Use MongoDB Atlas as the real cloud database.

Create the following Mongoose collections:

- businesses
- users
- sessions
- suppliers
- supplierAliases
- customers
- customerAliases
- products
- purchases
- purchaseItems
- sales
- saleItems
- inventoryLots
- inventoryMovements
- invoices
- invoiceSequences
- payments
- paymentAllocations
- expenses
- supplierQuotes
- priceHistory
- voiceJobs
- voiceDrafts
- conversations
- invoiceShareTokens
- auditLogs
- notificationPreferences

Use embedded line items where appropriate to avoid unnecessary collection complexity.

## Database Design Rules

- Every tenant-owned document must have a businessId.
- Use suitable indexes for businessId, date, customerId, supplierId and invoice number.
- Use unique indexes for invoice numbers and idempotency keys.
- Use MongoDB aggregation pipelines for reports.
- Avoid excessively large unbounded arrays.
- Use transactions for multi-document financial operations.
- Use atomic counter updates for invoice numbering.
- Apply consistent money and quantity precision.
- Validate documents through Mongoose and service-level rules.
- Keep invoice snapshots immutable after issuing, except controlled status transitions.
- Implement soft deletion or cancellation for financial documents where appropriate.

## Atlas Free-Tier Optimization

Respect Atlas Free limitations.

- Keep documents compact.
- Avoid unnecessary indexing.
- Paginate results.
- Limit expensive aggregations.
- Reuse database connections.
- Restrict connection-pool size.
- Avoid excessive polling.
- Do not store raw audio recordings in MongoDB.
- Do not store large PDF binaries in MongoDB.
- Monitor data and index storage.
- Keep development data separate from live financial records.

Atlas Free does not include managed backups.

Implement independently verified off-platform backups.

---

# 22. EXPRESS BACKEND ARCHITECTURE

Use modular, maintainable TypeScript code.

Suggested directory structure:

server/
  src/
    config/
    middleware/
    modules/
      auth/
      businesses/
      suppliers/
      customers/
      products/
      purchases/
      sales/
      inventory/
      invoices/
      payments/
      expenses/
      reports/
      priceHistory/
      voiceAI/
      conversations/
      notifications/
    shared/
      errors/
      logger/
      validators/
      financial/
      database/
    workers/
    app.ts
    server.ts

Separate:

- Routes
- Controllers
- Services
- Mongoose models
- Validators
- DTOs
- Background jobs

Do not place all code in one Express file.

Business rules belong in services.

Keep React Native components separate from backend calculations.

---

# 23. COMPLETE API CONTRACT

Implement working REST endpoints.

## Authentication

POST /api/auth/login

POST /api/auth/refresh

POST /api/auth/logout

GET /api/auth/me

## Voice Assistant

POST /api/voice/jobs

GET /api/voice/jobs/:id

POST /api/voice/interpret

POST /api/voice/clarify

POST /api/voice/confirm

POST /api/voice/cancel

## Dashboard

GET /api/dashboard/summary

GET /api/dashboard/charts

GET /api/dashboard/activity

## Purchases

GET /api/purchases

POST /api/purchases

GET /api/purchases/:id

## Sales

GET /api/sales

POST /api/sales

GET /api/sales/:id

## Customers

GET /api/customers

POST /api/customers

GET /api/customers/:id

PUT /api/customers/:id

GET /api/customers/:id/ledger

## Suppliers

GET /api/suppliers

POST /api/suppliers

GET /api/suppliers/:id

PUT /api/suppliers/:id

GET /api/suppliers/:id/ledger

## Inventory

GET /api/inventory

GET /api/inventory/lots

GET /api/inventory/movements

## Payments

GET /api/payments

POST /api/payments

GET /api/payments/outstanding

## Expenses

GET /api/expenses

POST /api/expenses

## Invoices

GET /api/invoices

POST /api/invoices

POST /api/invoices/:id/issue

POST /api/invoices/:id/cancel

GET /api/invoices/:id/pdf

POST /api/invoices/:id/share-link

## Reports

GET /api/reports/sales

GET /api/reports/purchases

GET /api/reports/profit

GET /api/reports/credit

GET /api/reports/price-history

Include:

- OpenAPI documentation
- Request validation
- Authentication
- Pagination
- Error handling
- Idempotency support
- Appropriate HTTP status codes

---

# 24. CLOUD DEPLOYMENT — ORACLE ALWAYS FREE

This is a mandatory deployment requirement.

Deploy the Node.js Express API to an **Oracle Cloud Infrastructure Always Free Ampere A1 ARM64 virtual machine**.

## Important Infrastructure Limits

Oracle's current Always Free Ampere A1 allowance is:

- 1,500 OCPU-hours monthly
- 9,000 GB-hours monthly

For an Always Free tenancy, this corresponds to a continuously allocated equivalent of approximately:

- 2 OCPUs
- 12 GB RAM

Use only resources eligible under the user's available Always Free allowance.

Do not assume free A1 capacity is always available in the selected home region.

Oracle may reclaim idle free instances.

Do not implement artificial traffic or activity merely to evade idle reclamation.

Provide clear fallback instructions if an Always Free instance cannot be provisioned.

## Step 1 — Create Oracle Account

Document how to:

1. Register for Oracle Cloud.
2. Choose a suitable home region.
3. Review Always Free eligibility.
4. Avoid unintentional paid resource selection.
5. Configure spending and usage alerts where supported.

Do not automatically upgrade the account to a paid tier.

## Step 2 — Provision Compute

Create an eligible Ubuntu ARM64 VM using:

VM.Standard.A1.Flex

Choose CPU and memory within the user's available Always Free entitlement.

Provision storage only within available free allocations.

Generate and configure SSH keys.

Use key-based SSH authentication.

## Step 3 — Networking

Configure:

- VCN
- Public subnet, if appropriate
- Internet gateway
- Route table
- Security list or network security group
- Public IP address when required

Permit only necessary inbound ports:

- 22 for SSH, restricted to trusted addresses
- 80 for HTTP certificate issuance or redirect
- 443 for HTTPS

Do not expose port 5000 or MongoDB database ports publicly.

Apply an operating-system firewall as well.

## Step 4 — Install Server Dependencies

Install ARM64-compatible versions of:

- Node.js LTS
- npm
- Git
- FFmpeg
- whisper.cpp build dependencies
- Caddy
- PM2 or systemd service configuration
- MongoDB Database Tools for backups

Avoid assuming x86-only binary packages work on ARM64.

Document ARM64-specific commands.

## Step 5 — Deploy Express Backend

Clone the repository or use a secure CI/CD artifact.

Install production dependencies.

Build TypeScript.

Configure production environment variables.

Run the backend under systemd or PM2 with automatic restart after failure or reboot.

Bind Express to localhost behind the reverse proxy.

## Step 6 — HTTPS

Configure Caddy to reverse-proxy the backend.

Example architecture:

Public HTTPS
→ Caddy
→ Express on 127.0.0.1:5000

Use a properly configured DNS hostname and automatic HTTPS certificates.

Provide domain and DNS instructions.

A custom domain may have a separate cost. Do not assume free domain availability.

## Step 7 — Health Monitoring

Provide endpoints:

GET /health/live

GET /health/ready

Readiness should account for MongoDB availability and critical service dependencies.

Include:

- Automatic process restart
- Structured logs
- Log rotation
- CPU usage monitoring
- Memory monitoring
- Storage monitoring
- API latency monitoring
- AI queue depth
- Speech processing failures

Do not log customer financial secrets or raw voice transcripts unnecessarily.

## Step 8 — Deployment Updates

Provide a safe deployment workflow.

Required behavior:

1. Fetch or receive new backend build.
2. Verify configuration.
3. Install dependencies.
4. Build.
5. Run tests and compatibility checks.
6. Restart or switch service safely.
7. Check readiness.
8. Restore previous build on failure where feasible.

Never expose production environment secrets in Git repositories.

---

# 25. CLOUD DATABASE — MONGODB ATLAS FREE

Use MongoDB Atlas M0 / Free cluster.

## Setup Instructions

1. Create an Atlas account.
2. Create a project named TamilTradeAI.
3. Create a Free cluster.
4. Select the closest suitable supported region to Oracle.
5. Create a least-privilege database user.
6. Configure the IP access list.
7. Copy the MongoDB connection string.
8. Store credentials in the backend environment.
9. Connect using Mongoose.
10. Create required indexes.
11. Verify database operations.

The React Native mobile application must NEVER directly connect to MongoDB Atlas.

All mobile data operations must go through authenticated Express APIs.

## Network Security

Allow access from the Oracle backend's actual outbound public IP.

Do not automatically configure unrestricted `0.0.0.0/0` access for production.

Use TLS-enabled MongoDB connections.

Keep credentials private.

## Connection Strategy

Create one reusable database connection pool.

Do not reconnect to MongoDB for every API request.

Use reasonable pool settings suitable for the Free cluster.

Handle temporary failures with bounded retries.

Do not overload Atlas with frequent background polling.

## Backups

Atlas Free does not provide built-in managed backup snapshots.

Implement scheduled `mongodump` exports.

Encrypt backup archives.

Store them securely outside the Oracle VM and outside Atlas.

Document a free or user-controlled backup destination and its capacity limits.

Test `mongorestore` regularly.

Never treat a backup saved only on the same VM as sufficient disaster recovery.

---

# 26. FREE TAMIL SPEECH AI ON ORACLE

Build whisper.cpp from source for ARM64.

## Requirements

- CPU-only inference
- Multilingual Tamil support
- Quantized model option
- Restricted concurrency
- Audio duration limits
- Temporary file cleanup
- Inference timeouts
- Memory monitoring
- No paid external API dependency

## Audio Processing Pipeline

1. Mobile uploads compressed audio.
2. Express validates authenticated user.
3. Check file size, duration and content type.
4. Store recording temporarily.
5. Create a voice-processing job.
6. Return job ID.
7. Background worker selects pending job.
8. Convert audio to compatible PCM WAV using FFmpeg.
9. Invoke whisper.cpp.
10. Extract transcription.
11. Normalize Tamil text.
12. Save structured transcript result.
13. Remove temporary audio according to retention policy.
14. Allow mobile app to retrieve job result.

## Performance Optimization

- Load model once where supported.
- Avoid launching and reloading large models for every request.
- Limit simultaneous transcription requests.
- Use a bounded job queue.
- Prevent duplicate uploads.
- Cache only safe reusable metadata.
- Avoid excessive audio retention.
- Keep normal Express APIs responsive while AI jobs are processing.
- Benchmark Base versus Small models.
- Optimize CPU threads based on the actual VM allocation.

A 2-OCPU VM may provide modest speech transcription performance.

Do not guarantee immediate responses.

Display real processing status and allow users to cancel pending requests where feasible.

If speech processing overwhelms the VM, document a future architecture that separates AI inference from the Express API.

---

# 27. DATABASE AND API PERFORMANCE

Optimize for a fast user experience.

## Backend

- Reuse MongoDB connections.
- Use lean Mongoose queries for read-only operations.
- Select only needed fields.
- Add indexes for frequent filters.
- Paginate all large lists.
- Avoid repeated unnecessary lookups.
- Precompute or cache expensive summaries when appropriate.
- Use HTTP compression where beneficial.
- Avoid synchronous heavy CPU work in the Express request path.
- Control background job concurrency.

## Mobile

- Use TanStack Query caching.
- Optimistic updates only where safe.
- Smooth skeleton loading.
- Prefetch frequently opened records.
- Debounce searches.
- Avoid loading all invoices simultaneously.
- Use efficient virtualized lists.
- Reduce unnecessary rerenders.
- Optimize images and animations.

## Performance Targets

Treat these as engineering targets, not promises:

- Cached screen navigation: near-instant
- Simple API operations: aim for sub-second responses under light load
- Customer and purchase lists: responsive with pagination
- Financial transaction confirmation: fast, correct and atomic
- Tamil voice recognition: benchmark actual latency by audio length, model and CPU

Measure:

- Median latency
- P95 latency
- Database query latency
- Speech-processing time
- App startup time
- Memory consumption
- API error rate

Correctness must never be sacrificed for speed.

---

# 28. NOTIFICATIONS AND REMINDERS

Implement:

- Customer payment reminders
- Supplier payment reminders
- Low-stock alerts
- Overdue invoice notifications
- Optional daily summaries

Use device-local notifications where appropriate.

For server-generated notifications, provide a proper push-notification architecture.

Handle permission requests.

Do not assume app notifications work automatically while offline.

Do not automatically send WhatsApp reminders without authorized integration and appropriate user consent.

---

# 29. FINANCIAL SAFETY AND AUDIT LOGGING

This application handles actual business money and records.

Financial safety is mandatory.

## Requirements

- Every purchase must be confirmed.
- Every sale must be confirmed.
- Every recorded payment must be confirmed.
- Every invoice issue action must be authorized.
- Monetary totals must be recalculated by backend services.
- Duplicate operations must be prevented.
- Stock movements must be auditable.
- Customer and supplier balances must be transaction-derived.
- Payment allocation must be explicit when ambiguous.
- Issued invoices must preserve historical details.
- Corrections must preserve an audit trail.
- Cancelled financial transactions must not silently disappear.

Use MongoDB sessions and transactions where suitable.

Use idempotency keys for retry-safe mutations.

Never execute arbitrary database updates directly from AI-generated instructions.

---

# 30. SECURITY AND PRIVACY

Implement:

- HTTPS
- Secure authentication
- Refresh token rotation
- Role-based authorization
- Business-level data isolation
- SecureStore on mobile
- Strong password hashing
- Input validation
- File validation
- Upload limits
- Rate limiting
- Security headers
- Audit logs
- Secure PDF links
- Proper CORS configuration where relevant
- Database credential protection
- Secret rotation procedures
- Safe error handling
- Backup encryption
- Data deletion and retention policies

Audio data should not be stored permanently by default.

Show users when voice recordings are being processed.

Never leak business credentials, invoice tokens or customer information in logs.

---

# 31. COMPLETE MOBILE SCREEN INVENTORY

Build the following screens with consistent premium styling.

## Authentication

1. Splash
2. Login
3. Account Setup
4. Business Setup

## Main Experience

5. Home Dashboard
6. Voice AI Assistant
7. Voice Transcript
8. AI Clarification
9. AI Confirmation
10. AI Conversation History

## Trading

11. Purchase List
12. New Purchase
13. Purchase Details
14. Sales List
15. New Sale
16. Sale Details

## Inventory

17. Inventory Overview
18. Stock Lots
19. Stock Movement History

## Customers and Suppliers

20. Customer List
21. Customer Details
22. Customer Ledger
23. Supplier List
24. Supplier Details
25. Supplier Ledger

## Financial

26. Credit Dashboard
27. Record Payment
28. Payment History
29. Expense Management
30. Profit Analytics

## Billing

31. Create Invoice
32. Invoice Preview
33. Invoice History
34. Invoice Details
35. Share Invoice

## Intelligence

36. Mill Price Comparison
37. Historical Price Charts
38. Business Reports
39. Customer Insights

## Settings

40. Business Profile
41. Staff and Permissions
42. Language and Appearance
43. Notifications
44. Security and Sessions

Do not implement screen count at the expense of quality.

All completed screens must have real interactions and working backend integration.

---

# 32. COMPLETE PROJECT DIRECTORY

TamilTradeAI/

mobile/
  app/
    (auth)/
    (tabs)/
    purchases/
    sales/
    customers/
    suppliers/
    inventory/
    payments/
    invoices/
    reports/
    settings/
  components/
    ui/
    dashboard/
    voice/
    financial/
    charts/
  features/
  services/
  hooks/
  store/
  theme/
  i18n/
  utils/
  types/
  assets/

server/
  src/
    config/
    middleware/
    modules/
      auth/
      dashboard/
      purchases/
      sales/
      suppliers/
      customers/
      products/
      inventory/
      payments/
      expenses/
      invoices/
      reports/
      priceHistory/
      voiceAI/
      conversations/
      notifications/
    workers/
    shared/
    app.ts
    server.ts
  scripts/
  tests/

speech/
  build/
  scripts/
  config/
  model-manifest/

infra/
  oracle/
  caddy/
  systemd/
  backup/
  deployment/

docs/
  architecture/
  database/
  api/
  deployment/
  operations/
  testing/

README.md

.env.example

.gitignore

Use environment variables for all configuration.

Never commit production secrets, large downloaded AI model binaries or sensitive audio files.

---

# 33. DEPLOYMENT ENVIRONMENT VARIABLES

Create configuration templates using placeholders.

## Server

NODE_ENV=production

PORT=5000

MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/tamiltradeai

JWT_ACCESS_SECRET=REPLACE_WITH_SECURE_SECRET

JWT_REFRESH_SECRET=REPLACE_WITH_DIFFERENT_SECURE_SECRET

APP_BASE_URL=https://api.example.com

SPEECH_MODEL_PATH=/opt/tamiltrade/models/whisper-model.bin

SPEECH_WORKER_CONCURRENCY=1

VOICE_MAX_DURATION_SECONDS=30

VOICE_MAX_FILE_SIZE_MB=10

INVOICE_STORAGE_PATH=/var/lib/tamiltrade/invoices

LOG_LEVEL=info

## Mobile

EXPO_PUBLIC_API_URL=https://api.example.com

Only public configuration may be included in Expo public variables.

Do not expose MongoDB credentials, JWT signing secrets or cloud access keys in the mobile application.

---

# 34. REAL-WORLD FULL END-TO-END EXAMPLE

Use this as the primary acceptance scenario.

## Step 1 — Owner Login

Owner opens TamilTrade AI on Android.

Logs in securely.

Premium dashboard loads actual financial information.

## Step 2 — Tamil Purchase Entry

Owner taps the central microphone.

Says:

"இன்னைக்கு ABC மில்லுல இருந்து 50 மூட்டை ஜவ்வரிசி வாங்கினேன். ஒரு மூட்டை 3200 ரூபாய். லாரி வாடகை 2500."

The application:

- Uploads audio.
- Transcribes Tamil.
- Detects purchase intent.
- Matches ABC Mill.
- Extracts 50 bags.
- Extracts ₹3,200 rate.
- Extracts ₹2,500 transport.
- Calculates ₹1,62,500 landed cost.
- Displays an editable confirmation sheet.

Owner confirms.

The backend stores the purchase transaction.

## Step 3 — Inventory

If the bags enter the business's warehouse, update stock movements and available stock.

If the bags are directly dispatched to a customer, record the direct-delivery relationship instead.

## Step 4 — Customer Sale

Owner says:

"அந்த 50 மூட்டையில் 20 மூட்டை ரமேஷுக்கு ஒரு மூட்டை 3500 ரூபாய்க்கு வித்தேன்."

The AI resolves the related purchase.

Creates a proposed sale:

- Customer: Ramesh Store
- Quantity: 20 bags
- Selling rate: ₹3,500
- Subtotal: ₹70,000

The app requests confirmation.

After confirmation, save the sale and update receivables and inventory allocation correctly.

## Step 5 — Invoice

Owner says:

"ரமேஷுக்கு பில் போடு."

The app identifies the recently confirmed sale.

Generates an invoice draft.

Owner reviews and issues it.

The backend assigns a valid invoice number and produces a PDF.

## Step 6 — WhatsApp

Owner taps Share.

The app opens native sharing with the invoice PDF, or prepares a WhatsApp message containing a secure invoice link.

Owner manually sends it.

## Step 7 — Payment

Owner says:

"ரமேஷ் 20 ஆயிரம் GPay பண்ணிட்டார்."

AI creates a pending payment record.

Owner confirms.

Backend records ₹20,000 against the appropriate invoice.

Remaining balance: ₹50,000, assuming no other payments or adjustments.

## Step 8 — Business Query

Owner asks:

"ரமேஷ் இன்னும் எவ்வளவு பாக்கி?"

The backend reads real ledger records.

Assistant displays and optionally speaks the verified outstanding amount.

## Step 9 — Profit

Owner asks:

"இந்த வியாபாரத்துல லாபம் எவ்வளவு?"

Calculate the applicable cost of 20 bags, including correctly allocated transport and other costs.

Show the profit amount as gross trading profit if operating expenses are excluded.

Explain any missing cost data.

Every result must reflect verified business records, not fabricated AI responses.

---

# 35. TESTING STRATEGY

Implement automated and manual testing.

## Unit Tests

- Tamil number parsing
- Intent classification
- Decimal calculations
- Quantity conversions
- Purchase totals
- Sales totals
- Profit calculations
- Payment allocation
- Invoice numbering
- Price comparisons

## Integration Tests

- Express + Atlas-compatible MongoDB
- Authentication
- Create purchase
- Create sale
- Record payment
- Update inventory
- Issue invoice
- Generate PDF
- Retrieve ledger
- Voice job processing

## Mobile Tests

- Microphone permissions
- Audio recording
- Uploading
- Network interruption
- Voice processing states
- Screen navigation
- Confirmation flows
- PDF downloading
- WhatsApp sharing
- Tamil Unicode rendering
- Low-memory devices
- Background and foreground transitions

## Security Tests

- Unauthorized access
- Cross-business access attempts
- Duplicate submissions
- Malicious uploads
- Expired share links
- Token replay
- Rate-limit enforcement

## Infrastructure Tests

- Oracle VM reboot
- Node process restart
- MongoDB connection recovery
- Speech worker crash
- Disk-space pressure
- Backup restoration
- TLS renewal
- Deployment rollback

Verify real end-to-end operation on a physical Android phone.

---

# 36. DEVELOPMENT AND DELIVERY PLAN

Implement in phases.

## PHASE 1 — Foundation and UI Design System

Deliver:

- Expo mobile project
- Express backend
- MongoDB Atlas connection
- Authentication
- Premium UI system
- Bottom navigation
- Business onboarding
- Dashboard shell

## PHASE 2 — Core Trading

Deliver:

- Suppliers
- Customers
- Products
- Purchases
- Sales
- Basic inventory

## PHASE 3 — Tamil Voice AI

Deliver:

- Microphone
- Local speech model
- Audio upload
- Voice jobs
- Tamil transcription
- Intent parsing
- Confirmation flow
- Purchase recording by voice

## PHASE 4 — Financial Features

Deliver:

- Customer balances
- Supplier balances
- Payments
- Expenses
- Profit calculations
- Financial dashboard

## PHASE 5 — Invoices and WhatsApp

Deliver:

- Invoice drafts
- PDF generation
- Invoice issuance
- Native sharing
- WhatsApp message sharing
- Customer statements

## PHASE 6 — Advanced Intelligence

Deliver:

- Multi-turn conversations
- Tamil corrections
- Business questions
- Price comparison
- Customer insights
- Optional TTS

## PHASE 7 — Oracle Cloud Deployment

Deliver:

- Oracle Always Free VM configuration
- ARM64 environment
- Express service deployment
- whisper.cpp deployment
- Caddy HTTPS
- Atlas production connection
- Health checks
- Backup scripts
- Process management

## PHASE 8 — Performance and Production Quality

Deliver:

- Query optimization
- UI performance improvements
- Concurrency control
- Speech benchmarks
- Security audit
- End-to-end testing
- Android release build
- iOS build instructions
- Operational documentation

Do not claim a phase is complete unless its acceptance tests pass.

---

# 37. EXACT DELIVERY INSTRUCTIONS TO AI `CODING AGENT

This section is mandatory.

When implementing the project:

1. First inspect the repository and check existing files.
2. Present a concise architecture and phased implementation plan.
3. Verify dependency compatibility.
4. Set up the mobile and server projects.
5. Create the UI design tokens and reusable components.
6. Implement MongoDB Atlas connection and environment configuration.
7. Implement and test authentication.
8. Implement complete business modules incrementally.
9. Implement voice processing using the local speech engine.
10. Connect mobile screens to real Express APIs.
11. Implement financial validation and confirmation workflows.
12. Build PDF and WhatsApp sharing.
13. Deploy the Express API on Oracle Always Free.
14. Test the real mobile application against the deployed HTTPS API.
15. Generate documentation and operational instructions.

### Code Quality Requirements

- Use TypeScript throughout the frontend and backend.
- Use strict type checking.
- Keep functions modular.
- Use reusable UI components.
- Avoid duplicate business logic.
- Follow consistent naming conventions.
- Validate requests and responses.
- Use structured error handling.
- Include unit tests and integration tests.
- Provide descriptive error messages.
- Handle network and server failures gracefully.

### No Placeholder Policy

Do not claim features are working when they are not.

Do not leave dummy actions connected only to success toasts.

Do not permanently hardcode dashboard data.

Do not silently replace difficult backend operations with mocked results.

Do not claim invoice PDFs or WhatsApp messages were sent unless the actual corresponding process occurred.

If a feature requires unavailable infrastructure, document the dependency and provide a working local equivalent where feasible.

### Development Output Requirements

For every completed phase, provide:

- Files created or modified
- Working source code
- Commands to install dependencies
- Environment variables required
- Run instructions
- Tests and their results
- Known limitations
- Instructions for verifying the feature manually

Do not stop at a visual prototype.

### UI Quality Gate

Every completed screen should demonstrate:

- Premium visual hierarchy
- Cohesive colors and typography
- Proper Tamil text rendering
- Beautiful spacing
- Polished iconography
- Fluid native transitions
- Functional controls
- Responsive touch interactions
- Accessible contrast
- Proper loading states
- Helpful empty states
- Error recovery

The final app must look and feel like a real, modern commercial mobile product.

---

# 38. FINAL ACCEPTANCE CRITERIA

The application is successful when the following complete workflow works:

1. Install TamilTrade AI on an Android phone.
2. Sign in securely.
3. Load real MongoDB Atlas business records.
4. Tap the animated microphone.
5. Speak naturally in Tamil.
6. Upload audio securely to Oracle Cloud.
7. Transcribe speech using CPU-hosted whisper.cpp.
8. Detect the business command.
9. Extract supplier, customer, product, quantity and price where applicable.
10. Show a beautifully designed confirmation card.
11. Allow correction of extracted values.
12. Save only after approval.
13. Commit financial changes consistently to MongoDB Atlas.
14. Update purchases, sales, inventory or payment ledgers correctly.
15. Generate professional invoice PDFs.
16. Share the PDF or invoice message through WhatsApp.
17. Answer spoken Tamil business questions using actual data.
18. Provide responsive, ultra-premium dashboards.
19. Work with an HTTPS Express API deployed on Oracle Always Free.
20. Provide monitoring, backups, error handling and documented recovery.

## FINAL NON-NEGOTIABLE GOAL

Build **TamilTrade AI**, an ultra-premium, intelligent, Tamil-first mobile trading assistant.

The application must combine:

**Luxury Mobile UI + Tamil Voice AI + Real Trading Operations + Accurate Financial Calculations + MongoDB Atlas + Oracle Always Free Hosting.**

It must be intuitive enough for a traditional trader who primarily uses WhatsApp.

It must be reliable enough to maintain genuine business transaction records.

It must be affordable enough to begin without paid AI APIs.

It must be modular enough to eventually become a SaaS product for other wholesale traders.

**Begin implementation with the repository structure, design system, architecture, MongoDB Atlas setup, and the first functional mobile screens. Then work through every phase systematically, validating functionality at each milestone.**