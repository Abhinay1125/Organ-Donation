// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OrganDonation
 * @notice Smart contract for organ donation management as specified in the IEEE reference framework:
 *         "Blockchain-Based Management for Organ Donation and Transplantation" (Yaqoob et al., IEEE Access 2022).
 * @dev Manages patient waiting-list registration, donor medical approvals, donor registrations, and match confirmations.
 */
contract OrganDonation {
    address public admin;
    address public patientDoctor;
    address public procurementOrganizer;
    address public hospitalTransplantTeam;
    address public organMatchingOrganizer;

    enum PatientStatus { WAITING, MATCHED, TRANSPLANTED, CANCELLED }
    enum DonorStatus { PENDING_APPROVAL, APPROVED, REJECTED, DONATED }

    struct Patient {
        string patientId;
        string patientName;
        string bloodGroup;
        string organType;
        uint256 age;
        uint256 bmi;
        string hospitalId;
        PatientStatus status;
        uint256 registrationTime;
        bool exists;
    }

    struct Donor {
        string donorId;
        string donorName;
        string bloodGroup;
        string organType;
        uint256 age;
        uint256 bmi;
        string hospitalId;
        DonorStatus status;
        bool isApproved;
        string medicalRemarks;
        uint256 registrationTime;
        bool exists;
    }

    struct MatchRecord {
        string matchId;
        string donorId;
        string patientId;
        string organType;
        uint256 scorePercent;
        string modelVersion;
        string reviewerRemarks;
        address authorizedReviewer;
        uint256 matchTime;
        bool exists;
    }

    mapping(string => Patient) public patients;
    mapping(string => Donor) public donors;
    mapping(string => MatchRecord) public matches;

    string[] public patientIds;
    string[] public donorIds;
    string[] public matchIds;

    // Events according to the IEEE specification
    event PatientAdded(
        string indexed patientId,
        string bloodGroup,
        string organType,
        address indexed doctor,
        uint256 timestamp
    );

    event DonorMedicalApproval(
        string indexed donorId,
        bool isApproved,
        string remarks,
        address indexed doctor,
        uint256 timestamp
    );

    event DonorRegistered(
        string indexed donorId,
        string bloodGroup,
        string organType,
        address indexed organizer,
        uint256 timestamp
    );

    event MatchGenerated(
        string indexed matchId,
        string indexed donorId,
        string indexed patientId,
        uint256 scorePercent,
        string modelVersion,
        address reviewer,
        uint256 timestamp
    );

    event RoleUpdated(string roleName, address newAccount, uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "OrganDonation: Caller is not admin");
        _;
    }

    modifier onlyPatientDoctor() {
        require(
            msg.sender == patientDoctor || msg.sender == admin,
            "OrganDonation: Caller is not authorized patient doctor"
        );
        _;
    }

    modifier onlyProcurementOrganizer() {
        require(
            msg.sender == procurementOrganizer || msg.sender == admin,
            "OrganDonation: Caller is not procurement organizer"
        );
        _;
    }

    modifier onlyMatchingOrganizer() {
        require(
            msg.sender == organMatchingOrganizer || msg.sender == hospitalTransplantTeam || msg.sender == admin,
            "OrganDonation: Caller is not authorized matching organizer"
        );
        _;
    }

    constructor() {
        admin = msg.sender;
        patientDoctor = msg.sender;
        procurementOrganizer = msg.sender;
        hospitalTransplantTeam = msg.sender;
        organMatchingOrganizer = msg.sender;
    }

    function setRoles(
        address _patientDoctor,
        address _procurementOrganizer,
        address _hospitalTransplantTeam,
        address _organMatchingOrganizer
    ) external onlyAdmin {
        patientDoctor = _patientDoctor;
        procurementOrganizer = _procurementOrganizer;
        hospitalTransplantTeam = _hospitalTransplantTeam;
        organMatchingOrganizer = _organMatchingOrganizer;
    }

    /**
     * @notice Registers a new patient to the organ waiting list.
     * @dev Function corresponding to AddingNewPatient in the IEEE paper.
     */
    function AddingNewPatient(
        string memory _patientId,
        string memory _patientName,
        string memory _bloodGroup,
        string memory _organType,
        uint256 _age,
        uint256 _bmi,
        string memory _hospitalId
    ) external onlyPatientDoctor {
        require(bytes(_patientId).length > 0, "Patient ID required");
        require(!patients[_patientId].exists, "Patient already registered");

        patients[_patientId] = Patient({
            patientId: _patientId,
            patientName: _patientName,
            bloodGroup: _bloodGroup,
            organType: _organType,
            age: _age,
            bmi: _bmi,
            hospitalId: _hospitalId,
            status: PatientStatus.WAITING,
            registrationTime: block.timestamp,
            exists: true
        });

        patientIds.push(_patientId);

        emit PatientAdded(_patientId, _bloodGroup, _organType, msg.sender, block.timestamp);
    }

    /**
     * @notice Records medical test evaluation and approval for a prospective donor.
     * @dev Function corresponding to TestApproval in the IEEE paper.
     */
    function TestApproval(
        string memory _donorId,
        bool _isApproved,
        string memory _remarks,
        string memory /* _doctorHash */
    ) external onlyPatientDoctor {
        require(bytes(_donorId).length > 0, "Donor ID required");
        if (donors[_donorId].exists) {
            donors[_donorId].isApproved = _isApproved;
            donors[_donorId].medicalRemarks = _remarks;
            donors[_donorId].status = _isApproved ? DonorStatus.APPROVED : DonorStatus.REJECTED;
        }

        emit DonorMedicalApproval(_donorId, _isApproved, _remarks, msg.sender, block.timestamp);
    }

    /**
     * @notice Registers an approved donor into the donation ledger.
     * @dev Function corresponding to RegisteringNewDonor in the IEEE paper.
     */
    function RegisteringNewDonor(
        string memory _donorId,
        string memory _donorName,
        string memory _bloodGroup,
        string memory _organType,
        uint256 _age,
        uint256 _bmi,
        string memory _hospitalId
    ) external onlyProcurementOrganizer {
        require(bytes(_donorId).length > 0, "Donor ID required");
        require(!donors[_donorId].exists, "Donor already registered");

        donors[_donorId] = Donor({
            donorId: _donorId,
            donorName: _donorName,
            bloodGroup: _bloodGroup,
            organType: _organType,
            age: _age,
            bmi: _bmi,
            hospitalId: _hospitalId,
            status: DonorStatus.APPROVED,
            isApproved: true,
            medicalRemarks: "Approved by clinical team",
            registrationTime: block.timestamp,
            exists: true
        });

        donorIds.push(_donorId);

        emit DonorRegistered(_donorId, _bloodGroup, _organType, msg.sender, block.timestamp);
    }

    /**
     * @notice Records an authorized matching decision between donor and patient.
     * @dev Function corresponding to MatchingProcess in the IEEE paper.
     *      Requires authorized human review confirmation; ML alone cannot execute this.
     */
    function MatchingProcess(
        string memory _matchId,
        string memory _donorId,
        string memory _patientId,
        string memory _organType,
        uint256 _scorePercent,
        string memory _modelVersion,
        string memory _reviewerRemarks
    ) external onlyMatchingOrganizer {
        require(bytes(_matchId).length > 0, "Match ID required");
        require(!matches[_matchId].exists, "Match already recorded");
        require(donors[_donorId].exists, "Donor not registered");
        require(patients[_patientId].exists, "Patient not registered");
        require(patients[_patientId].status == PatientStatus.WAITING, "Patient not in WAITING status");

        matches[_matchId] = MatchRecord({
            matchId: _matchId,
            donorId: _donorId,
            patientId: _patientId,
            organType: _organType,
            scorePercent: _scorePercent,
            modelVersion: _modelVersion,
            reviewerRemarks: _reviewerRemarks,
            authorizedReviewer: msg.sender,
            matchTime: block.timestamp,
            exists: true
        });

        matches[_matchId] = matches[_matchId];
        matchIds.push(_matchId);

        // Update patient status to MATCHED
        patients[_patientId].status = PatientStatus.MATCHED;

        emit MatchGenerated(
            _matchId,
            _donorId,
            _patientId,
            _scorePercent,
            _modelVersion,
            msg.sender,
            block.timestamp
        );
    }

    function getPatient(string memory _patientId) external view returns (Patient memory) {
        require(patients[_patientId].exists, "Patient not found");
        return patients[_patientId];
    }

    function getDonor(string memory _donorId) external view returns (Donor memory) {
        require(donors[_donorId].exists, "Donor not found");
        return donors[_donorId];
    }

    function getMatch(string memory _matchId) external view returns (MatchRecord memory) {
        require(matches[_matchId].exists, "Match not found");
        return matches[_matchId];
    }

    function getPatientCount() external view returns (uint256) {
        return patientIds.length;
    }

    function getDonorCount() external view returns (uint256) {
        return donorIds.length;
    }

    function getMatchCount() external view returns (uint256) {
        return matchIds.length;
    }
}
