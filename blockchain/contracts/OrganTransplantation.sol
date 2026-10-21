// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OrganTransplantation
 * @notice Smart contract for organ transplantation lifecycle, traceability, and movement
 *         as specified in the IEEE reference framework (Yaqoob et al., IEEE Access 2022).
 * @dev Enforces state transitions: RETRIEVED -> PACKAGED -> IN_TRANSIT -> DELIVERED -> RECEIVED -> TRANSPLANTED.
 */
contract OrganTransplantation {
    address public admin;
    address public donorSurgeon;
    address public transporter;
    address public transplantSurgeon;
    address public hospitalTransplantTeam;

    enum OrganState {
        NONE,
        RETRIEVED,
        PACKAGED,
        IN_TRANSIT,
        DELIVERED,
        RECEIVED,
        TRANSPLANTED
    }

    struct OrganJourney {
        string organId;
        string donorId;
        string patientId;
        string organType;
        string sourceHospital;
        string destinationHospital;
        string transporterName;
        OrganState currentState;
        uint256 retrievalTimestamp;
        uint256 deliveryTimestamp;
        uint256 transplantTimestamp;
        string outcomeRemarks;
        bool exists;
    }

    mapping(string => OrganJourney) public organs;
    string[] public organIds;

    // Events according to the IEEE specification
    event OrganRemoved(
        string indexed organId,
        string indexed donorId,
        string organType,
        string hospital,
        address indexed surgeon,
        uint256 timestamp
    );

    event OrganPackaged(
        string indexed organId,
        string hospital,
        address indexed actor,
        uint256 timestamp
    );

    event DeliveryStarted(
        string indexed organId,
        string sourceHospital,
        string destinationHospital,
        string transporterName,
        address indexed transporterAddress,
        uint256 timestamp
    );

    event DeliveryCompleted(
        string indexed organId,
        string destinationHospital,
        string conditionRemarks,
        address indexed transporterAddress,
        uint256 timestamp
    );

    event OrganReceived(
        string indexed organId,
        string destinationHospital,
        string recipientDoctor,
        address indexed surgeon,
        uint256 timestamp
    );

    event TransplantationCompleted(
        string indexed organId,
        string indexed patientId,
        string outcomeRemarks,
        address indexed surgeon,
        uint256 timestamp
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "OrganTransplantation: Caller is not admin");
        _;
    }

    modifier onlyDonorSurgeon() {
        require(
            msg.sender == donorSurgeon || msg.sender == hospitalTransplantTeam || msg.sender == admin,
            "OrganTransplantation: Caller is not authorized donor surgeon"
        );
        _;
    }

    modifier onlyTransporter() {
        require(
            msg.sender == transporter || msg.sender == admin,
            "OrganTransplantation: Caller is not authorized transporter"
        );
        _;
    }

    modifier onlyTransplantSurgeon() {
        require(
            msg.sender == transplantSurgeon || msg.sender == hospitalTransplantTeam || msg.sender == admin,
            "OrganTransplantation: Caller is not authorized transplant surgeon"
        );
        _;
    }

    constructor() {
        admin = msg.sender;
        donorSurgeon = msg.sender;
        transporter = msg.sender;
        transplantSurgeon = msg.sender;
        hospitalTransplantTeam = msg.sender;
    }

    function setRoles(
        address _donorSurgeon,
        address _transporter,
        address _transplantSurgeon,
        address _hospitalTransplantTeam
    ) external onlyAdmin {
        donorSurgeon = _donorSurgeon;
        transporter = _transporter;
        transplantSurgeon = _transplantSurgeon;
        hospitalTransplantTeam = _hospitalTransplantTeam;
    }

    /**
     * @notice Records the surgical removal of an organ from the donor.
     * @dev Corresponds to RemovingDonatedOrgan in the IEEE paper.
     */
    function RemovingDonatedOrgan(
        string memory _organId,
        string memory _donorId,
        string memory _organType,
        string memory _retrievalHospital,
        uint256 _timestamp
    ) external onlyDonorSurgeon {
        require(bytes(_organId).length > 0, "Organ ID required");
        require(!organs[_organId].exists, "Organ already registered on-chain");

        OrganJourney storage org = organs[_organId];
        org.organId = _organId;
        org.donorId = _donorId;
        org.patientId = "";
        org.organType = _organType;
        org.sourceHospital = _retrievalHospital;
        org.destinationHospital = "";
        org.transporterName = "";
        org.currentState = OrganState.RETRIEVED;
        org.retrievalTimestamp = _timestamp > 0 ? _timestamp : block.timestamp;
        org.deliveryTimestamp = 0;
        org.transplantTimestamp = 0;
        org.outcomeRemarks = "";
        org.exists = true;

        organIds.push(_organId);

        emit OrganRemoved(
            _organId,
            _donorId,
            _organType,
            _retrievalHospital,
            msg.sender,
            _timestamp > 0 ? _timestamp : block.timestamp
        );
    }

    /**
     * @notice Records organ packaging and preservation check before dispatch.
     */
    function PackageOrgan(
        string memory _organId,
        string memory _hospital,
        uint256 _timestamp
    ) external onlyDonorSurgeon {
        require(organs[_organId].exists, "Organ does not exist");
        require(
            organs[_organId].currentState == OrganState.RETRIEVED,
            "Invalid state transition: Organ must be in RETRIEVED state"
        );

        organs[_organId].currentState = OrganState.PACKAGED;

        emit OrganPackaged(
            _organId,
            _hospital,
            msg.sender,
            _timestamp > 0 ? _timestamp : block.timestamp
        );
    }

    /**
     * @notice Initiates transportation of the organ to the destination hospital.
     * @dev Corresponds to StartDelivery in the IEEE paper.
     */
    function StartDelivery(
        string memory _organId,
        string memory _transporterName,
        string memory _sourceHospital,
        string memory _destinationHospital,
        uint256 _timestamp
    ) external onlyTransporter {
        require(organs[_organId].exists, "Organ does not exist");
        require(
            organs[_organId].currentState == OrganState.RETRIEVED ||
            organs[_organId].currentState == OrganState.PACKAGED,
            "Invalid state transition: Organ must be RETRIEVED or PACKAGED"
        );

        organs[_organId].currentState = OrganState.IN_TRANSIT;
        organs[_organId].transporterName = _transporterName;
        organs[_organId].sourceHospital = _sourceHospital;
        organs[_organId].destinationHospital = _destinationHospital;

        emit DeliveryStarted(
            _organId,
            _sourceHospital,
            _destinationHospital,
            _transporterName,
            msg.sender,
            _timestamp > 0 ? _timestamp : block.timestamp
        );
    }

    /**
     * @notice Concludes physical transit at destination hospital gate/intake.
     * @dev Corresponds to EndDelivery in the IEEE paper.
     */
    function EndDelivery(
        string memory _organId,
        string memory _currentCondition,
        uint256 _timestamp
    ) external onlyTransporter {
        require(organs[_organId].exists, "Organ does not exist");
        require(
            organs[_organId].currentState == OrganState.IN_TRANSIT,
            "Invalid state transition: Organ must be IN_TRANSIT"
        );

        organs[_organId].currentState = OrganState.DELIVERED;
        organs[_organId].deliveryTimestamp = _timestamp > 0 ? _timestamp : block.timestamp;

        emit DeliveryCompleted(
            _organId,
            organs[_organId].destinationHospital,
            _currentCondition,
            msg.sender,
            _timestamp > 0 ? _timestamp : block.timestamp
        );
    }

    /**
     * @notice Destination clinical team receives and validates organ package.
     * @dev Corresponds to ReceiveDonatedOrgan in the IEEE paper.
     */
    function ReceiveDonatedOrgan(
        string memory _organId,
        string memory _destinationHospital,
        string memory _recipientDoctor,
        uint256 _timestamp
    ) external onlyTransplantSurgeon {
        require(organs[_organId].exists, "Organ does not exist");
        require(
            organs[_organId].currentState == OrganState.DELIVERED ||
            organs[_organId].currentState == OrganState.IN_TRANSIT,
            "Invalid state transition: Organ must be DELIVERED or IN_TRANSIT"
        );

        organs[_organId].currentState = OrganState.RECEIVED;

        emit OrganReceived(
            _organId,
            _destinationHospital,
            _recipientDoctor,
            msg.sender,
            _timestamp > 0 ? _timestamp : block.timestamp
        );
    }

    /**
     * @notice Records the final surgical transplantation into the recipient.
     * @dev Corresponds to Organ_Transplantation in the IEEE paper.
     */
    function Organ_Transplantation(
        string memory _organId,
        string memory _patientId,
        string memory _outcomeRemarks,
        uint256 _timestamp
    ) external onlyTransplantSurgeon {
        require(organs[_organId].exists, "Organ does not exist");
        require(
            organs[_organId].currentState == OrganState.RECEIVED,
            "Invalid state transition: Organ must be in RECEIVED state before transplantation"
        );

        organs[_organId].currentState = OrganState.TRANSPLANTED;
        organs[_organId].patientId = _patientId;
        organs[_organId].outcomeRemarks = _outcomeRemarks;
        organs[_organId].transplantTimestamp = _timestamp > 0 ? _timestamp : block.timestamp;

        emit TransplantationCompleted(
            _organId,
            _patientId,
            _outcomeRemarks,
            msg.sender,
            _timestamp > 0 ? _timestamp : block.timestamp
        );
    }

    function getOrgan(string memory _organId) external view returns (OrganJourney memory) {
        require(organs[_organId].exists, "Organ not found");
        return organs[_organId];
    }

    function getOrganCount() external view returns (uint256) {
        return organIds.length;
    }
}
