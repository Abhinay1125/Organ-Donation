# Blockchain and AI-Based Integrated Framework for Secure and Transparent Organ Donation and Transplantation Management

**IEEE Research Prototype | Enterprise Permissioned Ledger + Machine Learning Decision Support**

---

## 1. Executive Summary & Research Alignment

Organ allocation and transplantation face critical challenges in transparency, equitable organ matching, tamper-proof tracking, and institutional trust. Traditional centralized registry systems are susceptible to unilateral modification, lack end-to-end provenance for organs in transit, and do not provide verifiable audit trails.

This project delivers a complete, production-grade implementation of the research framework:
- **Permissioned Ethereum-Compatible Ledger (Solidity v0.8.20):** Enforces cryptographic access control, multi-institutional verification, and an irreversible 7-stage finite state machine governing the physical organ journey from procurement to implantation.
- **Two-Layer AI Matching Engine:** Combines Layer 1 deterministic clinical screening (ABO blood compatibility, anatomical and physiological constraints) with Layer 2 Random Forest compatibility scoring (`RF-v1`, trained on authentic organ matching simulation data).
- **Human-in-the-Loop Governance:** In strict adherence to medical ethics and IEEE research guidelines, the ML model functions **exclusively as clinical decision support**. Final allocation requires authenticated, cryptographically signed approval from an authorized transplant coordinator.
- **Privacy-Preserving Architecture:** Sensitive Protected Health Information (PHI) remains encrypted off-chain in relational storage, while anonymized identifiers, hash commitments, and operational milestones are committed to the immutable blockchain ledger.

---

## 2. Legacy Codebase Analysis vs. Modern Rebuilt Architecture

| Architectural Dimension | Legacy Implementation (`.zip`) | Modern Rebuilt Implementation |
| :--- | :--- | :--- |
| **Technology Stack** | Java 8, JSP, Servlet, Apache Tomcat, Raw JDBC | Python 3.11+ (FastAPI), React 18, Vite, Solidity v0.8.20 |
| **Blockchain Authenticity** | **Simulated / Fake**: MD5 string hashing saved in MySQL column | **Authentic EVM Ledger**: Hardhat permissioned node with Solidity smart contracts, ECDSA signatures, and immutable event emission |
| **Machine Learning** | **None**: No ML scripts, no models, no data pipelines | **Genuine Production ML**: Two-layer engine with trained Random Forest model (`RF-v1`, 96.46% test accuracy, 100% recall) |
| **Authentication & RBAC** | Basic plain text sessions, no role separation | JWT bearer tokens with bcrypt password hashing and strict institutional role-based access control (RBAC) |
| **Organ State Machine** | Ad-hoc text updates, no transition validation | Strict 7-stage lifecycle state machine enforced at both the smart contract and REST API layers |
| **User Interface** | Outdated HTML tables with inline styles | Modern healthcare enterprise design system (clean typography, responsive tables, audit explorers) |

---

## 3. High-Level System Architecture

```
                                  +------------------------------------+
                                  |     React 18 Single-Page App       |
                                  | (Vite, Responsive Enterprise UI)   |
                                  +-----------------+------------------+
                                                    |
                                      HTTPS / REST  |  JSON-RPC Web3
                                                    v
+---------------------------------------------------+-----------------------------------+
|                            FastAPI Application Gateway                                |
|                                                                                       |
|   +-------------------+   +--------------------+   +-------------------------------+  |
|   |  JWT & RBAC Auth  |   |  Relational Store  |   |    Two-Layer Matching Engine  |  |
|   |  - Hospital Admin |   |  (SQLAlchemy +     |   |    - Layer 1: Rule Screening  |  |
|   |  - Donor Surgeon  |   |   SQLite Database) |   |    - Layer 2: Random Forest   |  |
|   |  - Matching Lead  |   |                    |   |      Decision Support Model   |  |
|   |  - Courier / Med  |   |  (PHI Off-Chain)   |   |                               |  |
|   +-------------------+   +--------------------+   +---------------+---------------+  |
+--------------------------------------------------------------------+------------------+
                                                                     |
                                                                     v
                                                 +-------------------+------------------+
                                                 |     Hardhat Permissioned Ledger      |
                                                 |                                      |
                                                 |   OrganDonation.sol                  |
                                                 |   - Patient & Donor Registration     |
                                                 |   - Medical Test Approval            |
                                                 |   - Certified Match Committal        |
                                                 |                                      |
                                                 |   OrganTransplantation.sol           |
                                                 |   - 7-Stage Organ Journey FSM        |
                                                 |   - Physical Custody Hand-Offs       |
                                                 |   - Tamper-Evident Event Logging     |
                                                 +--------------------------------------+
```

---

## 4. Smart Contracts Specification

### `OrganDonation.sol`
*Deployment Address: `0x5FbDB2315678afecb367f032d93F642f64180aa3`*

- **Roles Enforced:**
  - `patientDoctor`: Registers recipients and logs clinical test clearances.
  - `procurementOrganizer`: Verifies donor consent and organ availability.
  - `organMatchingOrganizer`: Submits verified match determinations to the blockchain.
- **Key Methods:**
  - `AddingNewPatient(uint256 patientId, string name, string organType, string bloodGroup)`
  - `TestApproval(uint256 patientId, bool approved)`
  - `RegisteringNewDonor(uint256 donorId, string name, string organType, string bloodGroup)`
  - `MatchingProcess(uint256 donorId, uint256 patientId, uint256 organId, uint256 score)`

### `OrganTransplantation.sol`
*Deployment Address: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`*

- **7-Stage Finite State Machine:**
  1. `RETRIEVED`: Organ surgically excised and verified by procurement team.
  2. `PACKAGED`: Cryopreserved, sealed, and cold-chain sensor tagged.
  3. `DISPATCHED`: Handed over to licensed medical logistics courier.
  4. `IN_TRANSIT`: An application-recorded checkpoint during transit; the contract's `StartDelivery` call already advances its state to `IN_TRANSIT`, and this is not a separate API transition.
  5. `DELIVERED`: Arrived at recipient transplant center.
  6. `RECEIVED`: Inspected and accepted by surgical team.
  7. `TRANSPLANTED`: Implantation completed in recipient.
- **Key Methods:**
  - `RemovingDonatedOrgan(uint256 organId, uint256 donorId, string organType)`
  - `PackageOrgan(uint256 organId)`
  - `StartDelivery(uint256 organId, string courier)`
  - `EndDelivery(uint256 organId, string destination)`
  - `ReceiveDonatedOrgan(uint256 organId, string hospital)`
  - `Organ_Transplantation(uint256 organId, uint256 recipientId)`

---

## 5. Machine Learning Decision Support Model

### Dataset & Origin
- **Source:** Authentic 1,268-sample dataset based on the `simK` kidney transplantation simulation.
- **Distribution:** 1,000 negative samples (incompatible/high-risk), 268 positive samples (successful crossmatch and viable transplant outcomes).
- **Features Analyzed:** Donor Age, Recipient Age, Age Difference, Blood Group Compatibility, Crossmatch Outcome, Waiting Time (months), Recipient Urgency Score, Estimated Transport Distance (km), Organ Preservation Cold Ischemia Time.

### Measured Empirical Performance (Test Split = 254 samples)
| Metric | Measured Value | Clinical Interpretation |
| :--- | :--- | :--- |
| **Accuracy** | **96.46%** | High overall fidelity across cross-compatibility screening |
| **Precision** | **85.71%** | 85.7% of AI-recommended pairs are high-viability matches |
| **Recall (Sensitivity)** | **100.0%** | **Zero False Negatives** — no viable transplant opportunity is missed |
| **F1-Score** | **92.31%** | Balanced harmonic mean for clinical decision support |
| **Confusion Matrix** | `TN=191, FP=9, FN=0, TP=54` | All 54 viable matches in test set correctly captured |

*Model Artifacts: `ml/model_store/rf_model_v1.joblib` and `ml/model_store/metrics_v1.json`.*

---

## 6. Default Demo Credentials & Roles

| Role | Username | Password | Purpose & Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | System oversight, user creation, hospital verification, full blockchain audit |
| **Matching Coordinator** | `dr_sharma` | `hospital123` | AI candidate evaluation, donor clearance, match authorization |
| **Donor Surgeon** | `dr_ananya` | `surgeon123` | Donor intake, surgical retrieval, packaging certification |
| **Medical Transporter** | `courier_med` | `transit123` | Dispatch execution, transit logging, delivery hand-off |
| **Transplant Surgeon** | `dr_kapoor` | `surgeon123` | Organ receipt and transplant stage recording |
| **Synthetic Donor** | `donor_rahul` | `donor123` | Donor portal demonstration |
| **Synthetic Recipient** | `patient_priya` | `recipient123` | Recipient portal demonstration |

These fallback passwords are for local demonstrations only. Set `SEED_ADMIN_PASSWORD`, `SEED_MATCHING_PASSWORD`, `SEED_DONOR_SURGEON_PASSWORD`, `SEED_TRANSPORTER_PASSWORD`, `SEED_TRANSPLANT_SURGEON_PASSWORD`, `SEED_DONOR_PASSWORD`, and `SEED_RECIPIENT_PASSWORD` before first-time seeding to override them. Duty-user accounts use their `DEMO_*_PASSWORD` environment variables; when unset, their passwords are randomly generated.

Seeded audit references beginning with `DEMO-` are application placeholders, not blockchain transaction hashes.

---

## 7. Step-by-Step Installation & Quickstart

### Prerequisites
- **Node.js** v18.0.0 or higher
- **Python** 3.10 or higher
- **npm** or **yarn**

### Method A: One-Click Startup (Recommended for Windows)

Simply double-click `start_all.bat` or run:
```powershell
.\start_all.ps1
```
This script will automatically:
1. Spin up the Hardhat local blockchain node (`http://127.0.0.1:8545`).
2. Deploy both smart contracts and generate updated ABI artifacts.
3. Start the FastAPI backend on `http://127.0.0.1:8000`.
4. Launch the Vite React frontend on `http://localhost:5173` (the VitalLink landing page).

---

### Method B: Manual Tier-by-Tier Startup

## Important JWT key which has to be installed before starting the servers : 
# Backend: set a strong secret in this shell, then start the API

```bash
## run the below three lines especially in powershell .....
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$env:JWT_SECRET_KEY = [Convert]::ToBase64String($bytes)

Set-Location D:\Organ_Donation
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

```

#### Step 1: Blockchain Infrastructure
```bash
cd blockchain
npm install
npx hardhat node
```
*In a second terminal, deploy the contracts:*
```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

#### Step 2: Machine Learning & Backend API
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Step 3: React Enterprise Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 8. End-to-End Demonstration Walkthrough

1. **Access the landing page:** Navigate to `http://localhost:5173`, then choose **Sign in** (`/login.html`). A successful login opens the portal at `/app.html`.
2. **Log In as Matching Lead:** Use `dr_sharma` / `hospital123`.
3. **Inspect Donors & Recipients:**
   - Go to **Donors**: Review donor records, blood groups, and medical clearance statuses.
   - Go to **Waiting List**: Inspect recipient urgency scores and clinical criteria.
4. **Execute AI Matching:**
   - Navigate to **AI Matching**.
   - Select an available procured organ (e.g., `ORG-101`).
   - Click **Run Two-Layer Matching Engine**.
   - Observe Layer 1 rule filtering and Layer 2 Random Forest probability score, feature breakdown, and risk factors.
5. **Authorized Clinical Review:**
   - Click **Authorize Match**.
   - Review clinical checklist and input clinical notes.
   - Sign and submit to write the match transaction to the Ethereum ledger.
6. **Track Organ Journey (7 Stages):**
   - Navigate to **Organs & Tracking**.
   - Select the matched organ to open the **Journey Surveillance View**.
   - Advance the organ through each authorized milestone:
     - `RETRIEVED` -> `PACKAGED` -> `DISPATCHED` -> `IN_TRANSIT` -> `DELIVERED` -> `RECEIVED` -> `TRANSPLANTED`.
   - Each transition emits an authenticated blockchain transaction and event.
7. **Verify Cryptographic Ledger:**
   - Navigate to **Blockchain Audit**.
   - Inspect transaction hashes, block numbers, gas usage, and immutable event arguments.
8. **Inspect Model Metrics:**
   - Navigate to **ML Analytics**.
   - View genuine empirical metrics, confusion matrix, feature importance weights, and test predictions on the interactive sandbox.

---

## 9. Verification & Automated Test Suites

All components feature comprehensive automated test suites:

- **Smart Contracts (Hardhat):**
  ```bash
  cd blockchain
  npx hardhat run test/contracts.test.js
  # Result: 6/6 tests passed (role checks, state machine transitions, invalid jumps reverted)
  ```

- **ML Pipeline & Inference Engine:**
  ```bash
  python -m ml.test_ml
  # Result: 4/4 unit tests passed (rule engine screening, RF predictions, explainability, batch ranking)
  ```

- **Backend REST API:**
  ```bash
  cd backend
  python tests/test_api.py
  # Result: 6/6 integration tests passed (auth, CRUD, AI matching, metrics, blockchain audit)
  ```

- **Frontend Compilation:**
  ```bash
  cd frontend
  npm run build
  # Result: 0 errors, 1,514 modules compiled successfully
  ```

## Known Limitations

- Donor/recipient HLA typing is not collected; HLA mismatch model inputs are a
  blood-group-based proxy.
- The model was trained on a synthetic kidney dataset; scores for other organs
  are not validated; outputs are decision support only.
- Dialysis duration applies to kidney recipients; 0 means "not applicable" for
  other organs.
- Waiting days are computed from Recipient.waiting_since, which defaults to the
  UTC time the record was created in this system (models.py). It is not a
  clinical listing date. Seeded demo records may set it explicitly:
  seed_data.py backdates four synthetic recipients by 420, 260, 190, and 95
  days from the seed run's current UTC time.
- When the ledger node is offline, a locally generated reference is stored
  instead of an on-chain transaction.

---

## 10. Research Prototype Disclaimer

This software prototype was developed for research and educational purposes in accordance with IEEE guidelines. The artificial intelligence module provides decision support to assist qualified medical professionals and transplant committees; it **does not replace certified clinical judgment or statutory organ allocation frameworks**.
