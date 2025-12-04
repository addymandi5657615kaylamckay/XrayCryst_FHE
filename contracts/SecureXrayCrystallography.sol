// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract SecureXrayCrystallography is SepoliaConfig {
    struct EncryptedDiffractionImage {
        address researcher;
        euint32[] encryptedData; // Encrypted diffraction data
        uint256 timestamp;
    }
    
    struct EncryptedDensityMap {
        euint32[] encryptedMap; // Encrypted electron density map
        bool isComputed;
    }
    
    struct MolecularStructure {
        string structureData;
        bool isRevealed;
    }
    
    // Contract state
    uint256 public imageCount;
    mapping(uint256 => EncryptedDiffractionImage) public diffractionImages;
    mapping(uint256 => EncryptedDensityMap) public densityMaps;
    mapping(uint256 => MolecularStructure) public molecularStructures;
    
    // Computation tracking
    mapping(uint256 => uint256) private requestToImageId;
    
    // Events
    event ImageUploaded(uint256 indexed id, address indexed researcher);
    event ComputationStarted(uint256 indexed id);
    event DensityMapComputed(uint256 indexed id);
    event StructureDecrypted(uint256 indexed id);
    event DecryptionRequested(uint256 indexed id);

    /// @notice Upload encrypted diffraction image
    function uploadDiffractionImage(
        euint32[] memory encryptedData
    ) public {
        imageCount++;
        uint256 newId = imageCount;
        
        diffractionImages[newId] = EncryptedDiffractionImage({
            researcher: msg.sender,
            encryptedData: encryptedData,
            timestamp: block.timestamp
        });
        
        // Initialize computation states
        densityMaps[newId] = EncryptedDensityMap({
            encryptedMap: new euint32[](0),
            isComputed: false
        });
        
        molecularStructures[newId] = MolecularStructure({
            structureData: "",
            isRevealed: false
        });
        
        emit ImageUploaded(newId, msg.sender);
    }

    /// @notice Start electron density map computation
    function computeDensityMap(uint256 imageId) public {
        require(diffractionImages[imageId].researcher != address(0), "Image not found");
        require(!densityMaps[imageId].isComputed, "Already computed");
        
        // In real implementation, this would trigger off-chain computation
        // For demo, we'll simulate with dummy data
        euint32[] memory dummyMap = new euint32[](10);
        for (uint i = 0; i < 10; i++) {
            dummyMap[i] = FHE.asEuint32(i * 100);
        }
        
        densityMaps[imageId].encryptedMap = dummyMap;
        densityMaps[imageId].isComputed = true;
        
        emit DensityMapComputed(imageId);
    }

    /// @notice Request molecular structure decryption
    function requestStructureDecryption(uint256 imageId) public {
        require(diffractionImages[imageId].researcher == msg.sender, "Not owner");
        require(densityMaps[imageId].isComputed, "Density map not computed");
        require(!molecularStructures[imageId].isRevealed, "Already decrypted");
        
        // Prepare encrypted data for decryption
        bytes32[] memory ciphertexts = new bytes32[](densityMaps[imageId].encryptedMap.length);
        for (uint i = 0; i < densityMaps[imageId].encryptedMap.length; i++) {
            ciphertexts[i] = FHE.toBytes32(densityMaps[imageId].encryptedMap[i]);
        }
        
        // Request decryption
        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptStructureCallback.selector);
        requestToImageId[reqId] = imageId;
        
        emit DecryptionRequested(imageId);
    }

    /// @notice Handle structure decryption callback
    function decryptStructureCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 imageId = requestToImageId[requestId];
        require(imageId != 0, "Invalid request");
        
        MolecularStructure storage structure = molecularStructures[imageId];
        require(!structure.isRevealed, "Already decrypted");
        
        FHE.checkSignatures(requestId, cleartexts, proof);
        
        uint32[] memory values = abi.decode(cleartexts, (uint32[]));
        
        // Convert decrypted values to structure representation
        // In real implementation, this would involve complex molecular modeling
        string memory structureRep = generateStructureRepresentation(values);
        
        structure.structureData = structureRep;
        structure.isRevealed = true;
        
        emit StructureDecrypted(imageId);
    }

    /// @notice Get encrypted density map
    function getEncryptedDensityMap(uint256 imageId) public view returns (euint32[] memory) {
        require(densityMaps[imageId].isComputed, "Not computed");
        return densityMaps[imageId].encryptedMap;
    }

    /// @notice Get molecular structure
    function getMolecularStructure(uint256 imageId) public view returns (string memory) {
        require(molecularStructures[imageId].isRevealed, "Not decrypted");
        return molecularStructures[imageId].structureData;
    }

    /// @notice Helper to generate structure representation
    function generateStructureRepresentation(uint32[] memory values) private pure returns (string memory) {
        // Simplified representation for demo purposes
        // Real implementation would use complex molecular modeling
        string memory rep = "Molecular Structure:\n";
        for (uint i = 0; i < values.length; i++) {
            rep = string(abi.encodePacked(rep, "Atom ", uintToString(i+1), ": Density=", uintToString(values[i]), "\n"));
        }
        return rep;
    }

    /// @notice Helper to convert uint to string
    function uintToString(uint v) private pure returns (string memory) {
        if (v == 0) return "0";
        uint maxlength = 100;
        bytes memory reversed = new bytes(maxlength);
        uint i = 0;
        while (v != 0) {
            uint remainder = v % 10;
            v = v / 10;
            reversed[i++] = bytes1(uint8(48 + remainder));
        }
        bytes memory s = new bytes(i);
        for (uint j = 0; j < i; j++) {
            s[j] = reversed[i - 1 - j];
        }
        return string(s);
    }
}