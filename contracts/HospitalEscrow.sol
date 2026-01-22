//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IERC721 {
    function transferFrom(address _from, address _to, uint256 _id) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IMedicalAsset {
    function reduceQuantity(uint256 tokenId, uint256 amount) external;
    function hasAvailableQuantity(uint256 tokenId, uint256 requestedAmount) external view returns (bool);
    function remainingQuantity(uint256 tokenId) external view returns (uint256);
    function updateAssetStatus(uint256 tokenId, uint8 newStatus, string memory wardName, string memory patientId) external;
}

/**
 * @title HospitalEscrow
 * @dev Manages internal hospital medicine and equipment issuance workflow
 * This is NOT a supply chain or marketplace - it's an internal tracking system
 * NFTs represent digital records, NOT ownership transfer or trading
 * Roles: Hospital Admin, Ward Authority, Store Manager
 * 
 * Workflow:
 * 1. Ward Authority requests medicine/equipment
 * 2. Store Manager approves availability
 * 3. Hospital Admin approves and issues
 * 4. NFT status updated to track issuing
 */
contract HospitalEscrow {
    address public nftAddress;
    address public hospitalAdmin;
    address public storeManager;

    // Issuance request tracking
    struct IssuanceRequest {
        uint256 assetId;
        address wardAuthority;
        string wardName;
        string patientId;
        uint256 requestedQuantity;
        uint256 issuedQuantity;
        uint256 requestTimestamp;
        uint256 issuedTimestamp;
        bool isPending;
        bool storeApproved;
        bool adminApproved;
        bool isIssued;
        string remarks;
    }

    // Mapping from request ID to issuance request details
    mapping(uint256 => IssuanceRequest) public issuanceRequests;
    uint256 public requestCounter;

    // Mapping to track all requests for a ward
    mapping(address => uint256[]) public wardRequests;

    // Procurement request tracking (Store Manager requests stock from Hospital)
    struct ProcurementRequest {
        uint256 requestId;
        address storeManager;
        string itemName;
        string itemType;
        uint256 quantity;
        string reason;
        string urgency;
        string additionalNotes;
        uint256 requestTimestamp;
        uint256 approvedTimestamp;
        bool isPending;
        bool isApproved;
        bool isRejected;
        string hospitalResponse;
    }

    // Mapping from procurement request ID to procurement request details
    mapping(uint256 => ProcurementRequest) public procurementRequests;
    uint256 public procurementCounter;

    // Mapping to track all procurement requests by store manager
    mapping(address => uint256[]) public storeManagerProcurementRequests;

    // Events
    event IssuanceRequested(
        uint256 indexed requestId,
        uint256 indexed assetId,
        address indexed wardAuthority,
        string wardName,
        uint256 quantity,
        uint256 timestamp
    );

    event StoreApproved(
        uint256 indexed requestId,
        address indexed storeManager,
        uint256 timestamp
    );

    event AdminApproved(
        uint256 indexed requestId,
        address indexed hospitalAdmin,
        uint256 timestamp
    );
    
    event AssetIssued(
        uint256 indexed requestId,
        uint256 indexed assetId,
        address indexed wardAuthority,
        string wardName,
        string patientId,
        uint256 quantity,
        uint256 timestamp
    );

    event RequestCancelled(
        uint256 indexed requestId,
        address indexed cancelledBy,
        string reason
    );

    event ProcurementRequested(
        uint256 indexed procurementId,
        address indexed storeManager,
        string itemName,
        uint256 quantity,
        string urgency,
        uint256 timestamp
    );

    event ProcurementApproved(
        uint256 indexed procurementId,
        address indexed hospitalAdmin,
        uint256 timestamp
    );

    event ProcurementRejected(
        uint256 indexed procurementId,
        address indexed hospitalAdmin,
        string reason,
        uint256 timestamp
    );

    // Modifiers
    modifier onlyWardAuthority() {
        // In production, implement role-based access control
        // For now, any address can act as ward authority
        _;
    }

    modifier onlyHospitalAdmin() {
        require(msg.sender == hospitalAdmin, "Only hospital admin can call this");
        _;
    }

    modifier onlyStoreManager() {
        require(msg.sender == storeManager, "Only store manager can call this");
        _;
    }

    constructor(
        address _nftAddress,
        address _hospitalAdmin,
        address _storeManager
    ) {
        require(_nftAddress != address(0), "Invalid NFT address");
        require(_hospitalAdmin != address(0), "Invalid hospital admin address");
        require(_storeManager != address(0), "Invalid store manager address");
        
        nftAddress = _nftAddress;
        hospitalAdmin = _hospitalAdmin;
        storeManager = _storeManager;
        requestCounter = 0;
        procurementCounter = 0;
    }

    /**
     * @dev Ward authority submits a request for medicine/equipment
     * @param _assetId The asset NFT ID
     * @param _wardName The ward name requesting the asset
     * @param _patientId Patient ID (empty if issued to ward, not specific patient)
     * @param _quantity The quantity requested
     * @param _remarks Additional remarks or notes
     */
    function requestAsset(
        uint256 _assetId,
        string memory _wardName,
        string memory _patientId,
        uint256 _quantity,
        string memory _remarks
    ) public onlyWardAuthority returns (uint256) {
        require(_quantity > 0, "Requested quantity must be greater than zero");
        require(bytes(_wardName).length > 0, "Ward name is required");
        
        // Verify sufficient quantity available in the asset
        require(
            IMedicalAsset(nftAddress).hasAvailableQuantity(_assetId, _quantity),
            "Insufficient quantity in asset"
        );

        requestCounter++;
        uint256 requestId = requestCounter;

        issuanceRequests[requestId] = IssuanceRequest({
            assetId: _assetId,
            wardAuthority: msg.sender,
            wardName: _wardName,
            patientId: _patientId,
            requestedQuantity: _quantity,
            issuedQuantity: 0,
            requestTimestamp: block.timestamp,
            issuedTimestamp: 0,
            isPending: true,
            storeApproved: false,
            adminApproved: false,
            isIssued: false,
            remarks: _remarks
        });

        wardRequests[msg.sender].push(requestId);

        emit IssuanceRequested(requestId, _assetId, msg.sender, _wardName, _quantity, block.timestamp);

        return requestId;
    }

    /**
     * @dev Store manager approves the issuance request
     * @param _requestId The request ID
     */
    function approveByStore(uint256 _requestId) public onlyStoreManager {
        IssuanceRequest storage request = issuanceRequests[_requestId];
        require(request.isPending, "Request not pending");
        require(!request.isIssued, "Asset already issued");

        // Verify quantity still available
        require(
            IMedicalAsset(nftAddress).hasAvailableQuantity(request.assetId, request.requestedQuantity),
            "Insufficient quantity available"
        );

        request.storeApproved = true;

        emit StoreApproved(_requestId, msg.sender, block.timestamp);
    }

    /**
     * @dev Hospital admin approves the issuance request
     * @param _requestId The request ID
     */
    function approveByAdmin(uint256 _requestId) public onlyHospitalAdmin {
        IssuanceRequest storage request = issuanceRequests[_requestId];
        require(request.isPending, "Request not pending");
        require(!request.isIssued, "Asset already issued");
        require(request.storeApproved, "Store approval required first");

        request.adminApproved = true;

        emit AdminApproved(_requestId, msg.sender, block.timestamp);
    }

    /**
     * @dev Issue asset to ward/patient
     * Store Manager can issue items directly (corrected workflow)
     * Updates NFT status and reduces quantity
     * @param _requestId The request ID
     */
    function issueAsset(uint256 _requestId) public onlyStoreManager {
        IssuanceRequest storage request = issuanceRequests[_requestId];
        
        require(request.isPending, "Request not pending");
        require(!request.isIssued, "Asset already issued");
        
        // Verify quantity still available
        require(
            IMedicalAsset(nftAddress).hasAvailableQuantity(request.assetId, request.requestedQuantity),
            "Insufficient quantity available"
        );

        // Reduce quantity in the asset NFT
        IMedicalAsset(nftAddress).reduceQuantity(request.assetId, request.requestedQuantity);

        // Update NFT status based on patient ID
        uint8 newStatus = bytes(request.patientId).length > 0 ? 2 : 1; // 2 = IssuedToPatient, 1 = IssuedToWard
        IMedicalAsset(nftAddress).updateAssetStatus(
            request.assetId,
            newStatus,
            request.wardName,
            request.patientId
        );

        // Mark as issued
        request.isIssued = true;
        request.issuedQuantity = request.requestedQuantity;
        request.isPending = false;
        request.issuedTimestamp = block.timestamp;

        emit AssetIssued(
            _requestId,
            request.assetId,
            request.wardAuthority,
            request.wardName,
            request.patientId,
            request.requestedQuantity,
            block.timestamp
        );
    }

    /**
     * @dev Cancel an issuance request
     * Can be called by admin, store manager, or ward authority
     * @param _requestId The request ID
     * @param _reason Reason for cancellation
     */
    function cancelRequest(uint256 _requestId, string memory _reason) public {
        IssuanceRequest storage request = issuanceRequests[_requestId];
        require(
            msg.sender == hospitalAdmin || 
            msg.sender == storeManager || 
            msg.sender == request.wardAuthority,
            "Not authorized to cancel"
        );
        require(!request.isIssued, "Cannot cancel issued asset");

        // Reset the request
        request.isPending = false;

        emit RequestCancelled(_requestId, msg.sender, _reason);
    }

    /**
     * @dev Get issuance request details
     * @param _requestId The request ID
     * @return Full request information
     */
    function getIssuanceRequest(uint256 _requestId)
        public
        view
        returns (IssuanceRequest memory)
    {
        return issuanceRequests[_requestId];
    }

    /**
     * @dev Get all requests made by a ward authority
     * @param _wardAuthority The ward authority address
     * @return Array of request IDs
     */
    function getWardRequests(address _wardAuthority)
        public
        view
        returns (uint256[] memory)
    {
        return wardRequests[_wardAuthority];
    }

    /**
     * @dev Get all pending requests
     * @return Array of pending request IDs
     */
    function getPendingRequests()
        public
        view
        returns (uint256[] memory)
    {
        uint256 pendingCount = 0;
        
        // Count pending requests
        for (uint256 i = 1; i <= requestCounter; i++) {
            if (issuanceRequests[i].isPending) {
                pendingCount++;
            }
        }

        // Create array of pending request IDs
        uint256[] memory pendingRequests = new uint256[](pendingCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= requestCounter; i++) {
            if (issuanceRequests[i].isPending) {
                pendingRequests[index] = i;
                index++;
            }
        }

        return pendingRequests;
    }

    /**
     * @dev Update hospital admin address
     * @param _newAdmin New hospital admin address
     */
    function updateHospitalAdmin(address _newAdmin) public onlyHospitalAdmin {
        require(_newAdmin != address(0), "Invalid address");
        hospitalAdmin = _newAdmin;
    }

    /**
     * @dev Update store manager address
     * @param _newManager New store manager address
     */
    function updateStoreManager(address _newManager) public onlyHospitalAdmin {
        require(_newManager != address(0), "Invalid address");
        storeManager = _newManager;
    }

    // ========== PROCUREMENT REQUEST FUNCTIONS ==========

    /**
     * @dev Store Manager submits a procurement request to Hospital Authority
     * @param _itemName Name of the item needed
     * @param _itemType Type of item (medicine/equipment/supplies)
     * @param _quantity Quantity needed
     * @param _reason Reason for request
     * @param _urgency Urgency level
     * @param _additionalNotes Additional notes
     */
    function createProcurementRequest(
        string memory _itemName,
        string memory _itemType,
        uint256 _quantity,
        string memory _reason,
        string memory _urgency,
        string memory _additionalNotes
    ) public onlyStoreManager returns (uint256) {
        require(_quantity > 0, "Quantity must be greater than zero");
        require(bytes(_itemName).length > 0, "Item name is required");

        procurementCounter++;
        uint256 procurementId = procurementCounter;

        procurementRequests[procurementId] = ProcurementRequest({
            requestId: procurementId,
            storeManager: msg.sender,
            itemName: _itemName,
            itemType: _itemType,
            quantity: _quantity,
            reason: _reason,
            urgency: _urgency,
            additionalNotes: _additionalNotes,
            requestTimestamp: block.timestamp,
            approvedTimestamp: 0,
            isPending: true,
            isApproved: false,
            isRejected: false,
            hospitalResponse: ""
        });

        storeManagerProcurementRequests[msg.sender].push(procurementId);

        emit ProcurementRequested(
            procurementId,
            msg.sender,
            _itemName,
            _quantity,
            _urgency,
            block.timestamp
        );

        return procurementId;
    }

    /**
     * @dev Hospital Admin approves a procurement request
     * @param _procurementId The procurement request ID
     * @param _response Hospital's response message
     */
    function approveProcurementRequest(
        uint256 _procurementId,
        string memory _response
    ) public onlyHospitalAdmin {
        ProcurementRequest storage request = procurementRequests[_procurementId];
        require(request.isPending, "Request is not pending");
        require(!request.isApproved && !request.isRejected, "Request already processed");

        request.isPending = false;
        request.isApproved = true;
        request.approvedTimestamp = block.timestamp;
        request.hospitalResponse = _response;

        emit ProcurementApproved(_procurementId, msg.sender, block.timestamp);
    }

    /**
     * @dev Hospital Admin rejects a procurement request
     * @param _procurementId The procurement request ID
     * @param _reason Reason for rejection
     */
    function rejectProcurementRequest(
        uint256 _procurementId,
        string memory _reason
    ) public onlyHospitalAdmin {
        ProcurementRequest storage request = procurementRequests[_procurementId];
        require(request.isPending, "Request is not pending");
        require(!request.isApproved && !request.isRejected, "Request already processed");

        request.isPending = false;
        request.isRejected = true;
        request.hospitalResponse = _reason;

        emit ProcurementRejected(_procurementId, msg.sender, _reason, block.timestamp);
    }

    /**
     * @dev Get procurement request details
     * @param _procurementId The procurement request ID
     * @return Full procurement request information
     */
    function getProcurementRequest(uint256 _procurementId)
        public
        view
        returns (ProcurementRequest memory)
    {
        return procurementRequests[_procurementId];
    }

    /**
     * @dev Get all procurement requests made by store manager
     * @param _storeManager The store manager address
     * @return Array of procurement request IDs
     */
    function getStoreManagerProcurementRequests(address _storeManager)
        public
        view
        returns (uint256[] memory)
    {
        return storeManagerProcurementRequests[_storeManager];
    }

    /**
     * @dev Get all pending procurement requests
     * @return Array of pending procurement request IDs
     */
    function getPendingProcurementRequests() public view returns (uint256[] memory) {
        uint256 pendingCount = 0;
        for (uint256 i = 1; i <= procurementCounter; i++) {
            if (procurementRequests[i].isPending) {
                pendingCount++;
            }
        }

        uint256[] memory pendingIds = new uint256[](pendingCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= procurementCounter; i++) {
            if (procurementRequests[i].isPending) {
                pendingIds[index] = i;
                index++;
            }
        }

        return pendingIds;
    }
}
