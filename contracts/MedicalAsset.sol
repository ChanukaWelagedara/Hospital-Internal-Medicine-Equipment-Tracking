//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title MedicalAsset
 * @dev NFT contract for internal hospital medicine and equipment tracking
 * Each NFT represents a unique medicine batch or medical equipment unit
 * NFTs are used as digital records for tracking, NOT for ownership transfer or trading
 * This is an internal hospital system where NFT transfers represent status changes only
 */
contract MedicalAsset is ERC721URIStorage {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Hospital admin - only authorized to mint new assets
    address public hospitalAdmin;

    // Item types
    enum ItemType { Medicine, Equipment }
    
    // Item status
    enum ItemStatus { InStore, IssuedToWard, IssuedToPatient, Expired, Disposed }

    // Asset tracking structure
    struct AssetInfo {
        uint256 tokenId;
        ItemType itemType;
        uint256 totalQuantity;
        uint256 remainingQuantity;
        ItemStatus status;
        string wardName;
        string patientId;
        address issuedBy;
        uint256 issuedTimestamp;
    }

    // Mapping from token ID to asset information
    mapping(uint256 => AssetInfo) public assetInfo;
    
    // Mapping from token ID to total quantity in batch (for backwards compatibility)
    mapping(uint256 => uint256) public totalQuantity;
    
    // Mapping from token ID to remaining quantity available (for backwards compatibility)
    mapping(uint256 => uint256) public remainingQuantity;

    // Events
    event AssetMinted(
        uint256 indexed tokenId,
        address indexed hospitalAdmin,
        ItemType itemType,
        uint256 quantity,
        string tokenURI
    );

    event StatusUpdated(
        uint256 indexed tokenId,
        ItemStatus newStatus,
        string wardName,
        string patientId,
        address indexed issuedBy,
        uint256 timestamp
    );

    event QuantityReduced(
        uint256 indexed tokenId,
        uint256 reducedAmount,
        uint256 remainingAmount
    );

    // Modifiers
    modifier onlyHospitalAdmin() {
        require(msg.sender == hospitalAdmin, "Only hospital admin can call this");
        _;
    }

    constructor(address _hospitalAdmin) ERC721("Hospital Medical Asset", "HMA") {
        require(_hospitalAdmin != address(0), "Invalid hospital admin address");
        hospitalAdmin = _hospitalAdmin;
    }

    /**
     * @dev Mint a new medical asset NFT (medicine batch or equipment)
     * Only hospital admin can mint assets
     * @param tokenURI IPFS URI containing asset metadata
     * @param quantity Total quantity of units (1 for single equipment, N for medicine batch)
     * @param itemType Type of asset: Medicine or Equipment
     * @return The ID of the newly minted asset NFT
     */
    function mintAsset(
        string memory tokenURI, 
        uint256 quantity,
        ItemType itemType
    ) 
        public 
        onlyHospitalAdmin
        returns (uint256) 
    {
        require(quantity > 0, "Quantity must be greater than zero");

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        
        // Mint NFT to hospital admin (central authority)
        _mint(hospitalAdmin, newItemId);
        _setTokenURI(newItemId, tokenURI);
        
        // Set quantity tracking
        totalQuantity[newItemId] = quantity;
        remainingQuantity[newItemId] = quantity;

        // Initialize asset info
        assetInfo[newItemId] = AssetInfo({
            tokenId: newItemId,
            itemType: itemType,
            totalQuantity: quantity,
            remainingQuantity: quantity,
            status: ItemStatus.InStore,
            wardName: "",
            patientId: "",
            issuedBy: address(0),
            issuedTimestamp: 0
        });

        emit AssetMinted(newItemId, hospitalAdmin, itemType, quantity, tokenURI);

        return newItemId;
    }

    /**
     * @dev Update asset status when issued to ward or patient
     * Can only be called by hospital admin or approved addresses
     * @param tokenId The asset NFT ID
     * @param newStatus The new status
     * @param wardName Ward name (if issued to ward)
     * @param patientId Patient ID (if issued to patient)
     */
    function updateAssetStatus(
        uint256 tokenId,
        ItemStatus newStatus,
        string memory wardName,
        string memory patientId
    ) external {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Caller is not owner nor approved");
        require(_exists(tokenId), "Asset does not exist");

        AssetInfo storage info = assetInfo[tokenId];
        info.status = newStatus;
        info.wardName = wardName;
        info.patientId = patientId;
        info.issuedBy = msg.sender;
        info.issuedTimestamp = block.timestamp;

        emit StatusUpdated(tokenId, newStatus, wardName, patientId, msg.sender, block.timestamp);
    }

    /**
     * @dev Reduce the remaining quantity when medicine is issued
     * Can only be called by the NFT owner or approved address
     * @param tokenId The medicine batch NFT ID
     * @param amount The quantity to reduce
     */
    function reduceQuantity(uint256 tokenId, uint256 amount) external {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Caller is not owner nor approved");
        require(remainingQuantity[tokenId] >= amount, "Insufficient quantity available");

        remainingQuantity[tokenId] -= amount;
        assetInfo[tokenId].remainingQuantity = remainingQuantity[tokenId];

        emit QuantityReduced(tokenId, amount, remainingQuantity[tokenId]);
    }

    /**
     * @dev Get complete asset information
     * @param tokenId The asset NFT ID
     * @return Asset information struct
     */
    function getAssetInfo(uint256 tokenId) public view returns (AssetInfo memory) {
        require(_exists(tokenId), "Asset does not exist");
        return assetInfo[tokenId];
    }

    /**
     * @dev Get total supply of medicine batches
     * @return Total number of medicine batch NFTs minted
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIds.current();
    }

    /**
     * @dev Check if a medicine batch has sufficient quantity available
     * @param tokenId The medicine batch NFT ID
     * @param requestedAmount The amount being requested
     * @return True if sufficient quantity is available
     */
    function hasAvailableQuantity(uint256 tokenId, uint256 requestedAmount) 
        public 
        view 
        returns (bool) 
    {
        return remainingQuantity[tokenId] >= requestedAmount;
    }

    /**
     * @dev Get medicine batch details
     * @param tokenId The medicine batch NFT ID
     * @return total Total quantity in batch
     * @return remaining Remaining quantity available
     * @return owner Owner of the medicine batch NFT
     */
    function getBatchDetails(uint256 tokenId) 
        public 
        view 
        returns (
            uint256 total,
            uint256 remaining,
            address owner
        ) 
    {
        require(_exists(tokenId), "Medicine batch does not exist");
        return (
            totalQuantity[tokenId],
            remainingQuantity[tokenId],
            ownerOf(tokenId)
        );
    }

    /**
     * @dev Override transfer functions to restrict transfers to hospital roles only
     * NFTs should only transfer internally within hospital system
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, tokenId);
        
        // Allow minting (from = 0) and burning (to = 0)
        if (from == address(0) || to == address(0)) {
            return;
        }
        
        // In production, add role-based access control here
        // For now, we allow transfers but log them for audit
    }
}
