// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract InvoiceRegistry is ERC721, Ownable, ReentrancyGuard {
    uint256 private _tokenIdCounter;

    enum InvoiceStatus { Pending, Escrowed, Funded, Settled, Defaulted }

    struct Invoice {
        uint256 id;
        address seller;
        uint256 faceValue;
        uint256 dueDate;
        bytes32 currency;
        bytes32 documentHash;
        InvoiceStatus status;
        uint256 createdAt;
        string buyerName;
        string description;
    }

    mapping(uint256 => Invoice) public invoices;
    mapping(address => uint256[]) public sellerInvoices;

    address public lendingPool;
    address public fxSettlement;

    event InvoiceMinted(uint256 indexed id, address indexed seller, uint256 faceValue, uint256 dueDate);
    event InvoiceEscrowed(uint256 indexed id, address indexed pool);
    event InvoiceSettled(uint256 indexed id, uint256 settledAmount);
    event InvoiceDefaulted(uint256 indexed id);

    modifier onlyAuthorized() {
        require(
            msg.sender == lendingPool || msg.sender == fxSettlement || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }

    constructor() ERC721("Arc Invoice", "AINV") Ownable(msg.sender) {}

    function setLendingPool(address _pool) external onlyOwner {
        lendingPool = _pool;
    }

    function setFxSettlement(address _settlement) external onlyOwner {
        fxSettlement = _settlement;
    }

    function mintInvoice(
        uint256 faceValue,
        uint256 dueDate,
        bytes32 currency,
        bytes32 documentHash,
        string calldata buyerName,
        string calldata description
    ) external returns (uint256) {
        require(faceValue > 0, "Face value must be positive");
        require(dueDate > block.timestamp, "Due date must be in future");

        uint256 tokenId = ++_tokenIdCounter;

        invoices[tokenId] = Invoice({
            id: tokenId,
            seller: msg.sender,
            faceValue: faceValue,
            dueDate: dueDate,
            currency: currency,
            documentHash: documentHash,
            status: InvoiceStatus.Pending,
            createdAt: block.timestamp,
            buyerName: buyerName,
            description: description
        });

        sellerInvoices[msg.sender].push(tokenId);
        _safeMint(msg.sender, tokenId);

        emit InvoiceMinted(tokenId, msg.sender, faceValue, dueDate);
        return tokenId;
    }

    function lockInEscrow(uint256 tokenId) external onlyAuthorized {
        Invoice storage inv = invoices[tokenId];
        require(inv.status == InvoiceStatus.Pending, "Invoice not pending");
        inv.status = InvoiceStatus.Escrowed;
        emit InvoiceEscrowed(tokenId, msg.sender);
    }

    function markFunded(uint256 tokenId) external onlyAuthorized {
        Invoice storage inv = invoices[tokenId];
        require(inv.status == InvoiceStatus.Escrowed, "Invoice not escrowed");
        inv.status = InvoiceStatus.Funded;
    }

    function burnOnSettle(uint256 tokenId, uint256 settledAmount) external onlyAuthorized {
        Invoice storage inv = invoices[tokenId];
        require(inv.status == InvoiceStatus.Funded, "Invoice not funded");
        inv.status = InvoiceStatus.Settled;
        _burn(tokenId);
        emit InvoiceSettled(tokenId, settledAmount);
    }

    function markDefaulted(uint256 tokenId) external onlyAuthorized {
        Invoice storage inv = invoices[tokenId];
        require(inv.status == InvoiceStatus.Funded, "Invoice not funded");
        inv.status = InvoiceStatus.Defaulted;
        emit InvoiceDefaulted(tokenId);
    }

    function getInvoice(uint256 tokenId) external view returns (Invoice memory) {
        return invoices[tokenId];
    }

    function getSellerInvoices(address seller) external view returns (uint256[] memory) {
        return sellerInvoices[seller];
    }

    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }
}
