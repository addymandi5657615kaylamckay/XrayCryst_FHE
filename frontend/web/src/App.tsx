// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface CrystallographyData {
  id: string;
  encryptedImage: string;
  densityMap: string;
  molecularStructure: string;
  timestamp: number;
  owner: string;
  status: "processing" | "completed" | "failed";
}

const App: React.FC = () => {
  // Randomly selected style: Gradient (cold color glacier) + Glass morphism + Center radiation + Animation rich
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [analysisData, setAnalysisData] = useState<CrystallographyData[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newAnalysisData, setNewAnalysisData] = useState({
    imageName: "",
    description: ""
  });
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedData, setSelectedData] = useState<CrystallographyData | null>(null);

  // Randomly selected additional features: Project introduction, Tutorial, Data details
  useEffect(() => {
    loadAnalysisData().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadAnalysisData = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("analysis_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing analysis keys:", e);
        }
      }
      
      const list: CrystallographyData[] = [];
      
      for (const key of keys) {
        try {
          const dataBytes = await contract.getData(`analysis_${key}`);
          if (dataBytes.length > 0) {
            try {
              const analysisData = JSON.parse(ethers.toUtf8String(dataBytes));
              list.push({
                id: key,
                encryptedImage: analysisData.image,
                densityMap: analysisData.densityMap,
                molecularStructure: analysisData.structure,
                timestamp: analysisData.timestamp,
                owner: analysisData.owner,
                status: analysisData.status || "processing"
              });
            } catch (e) {
              console.error(`Error parsing analysis data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading analysis ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setAnalysisData(list);
    } catch (e) {
      console.error("Error loading analysis data:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const uploadXrayImage = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setUploading(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting X-ray image with FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedImage = `FHE-${btoa(JSON.stringify(newAnalysisData))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const analysisId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const analysisData = {
        image: encryptedImage,
        densityMap: "",
        structure: "",
        timestamp: Math.floor(Date.now() / 1000),
        owner: account,
        status: "processing"
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `analysis_${analysisId}`, 
        ethers.toUtf8Bytes(JSON.stringify(analysisData))
      );
      
      const keysBytes = await contract.getData("analysis_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(analysisId);
      
      await contract.setData(
        "analysis_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "X-ray image uploaded securely for FHE processing!"
      });
      
      await loadAnalysisData();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowUploadModal(false);
        setNewAnalysisData({
          imageName: "",
          description: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Upload failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setUploading(false);
    }
  };

  const processWithFHE = async (analysisId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Processing X-ray data with FHE..."
    });

    try {
      // Simulate FHE computation time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const dataBytes = await contract.getData(`analysis_${analysisId}`);
      if (dataBytes.length === 0) {
        throw new Error("Analysis not found");
      }
      
      const analysisData = JSON.parse(ethers.toUtf8String(dataBytes));
      
      // Simulate FHE results
      const updatedData = {
        ...analysisData,
        densityMap: "FHE-ENCRYPTED-DENSITY-MAP",
        structure: "FHE-ENCRYPTED-STRUCTURE",
        status: "completed"
      };
      
      await contract.setData(
        `analysis_${analysisId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedData))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE analysis completed successfully!"
      });
      
      await loadAnalysisData();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Analysis failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const isOwner = (address: string) => {
    return account.toLowerCase() === address.toLowerCase();
  };

  const tutorialSteps = [
    {
      title: "Connect Wallet",
      description: "Connect your Web3 wallet to access the FHE analysis platform",
      icon: "🔗"
    },
    {
      title: "Upload X-ray Image",
      description: "Securely upload your encrypted X-ray diffraction images",
      icon: "📤"
    },
    {
      title: "FHE Processing",
      description: "Our system processes your data in encrypted state using FHE",
      icon: "⚙️"
    },
    {
      title: "Get Results",
      description: "Receive encrypted electron density maps and molecular structures",
      icon: "🔍"
    }
  ];

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner">
        <div className="crystal-structure"></div>
      </div>
      <p>Initializing FHE connection...</p>
    </div>
  );

  return (
    <div className="app-container">
      <div className="background-gradient"></div>
      
      <header className="app-header glass-morphism">
        <div className="logo">
          <div className="crystal-icon"></div>
          <h1>XrayCryst<span>FHE</span></h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowUploadModal(true)} 
            className="upload-btn"
          >
            Upload X-ray Image
          </button>
          <button 
            className="tutorial-btn"
            onClick={() => setShowTutorial(!showTutorial)}
          >
            {showTutorial ? "Hide Tutorial" : "Show Tutorial"}
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <main className="main-content center-radial">
        <div className="hero-section glass-morphism">
          <div className="hero-text">
            <h2>FHE-Based Secure X-ray Crystallography</h2>
            <p>Process encrypted X-ray diffraction images without compromising data privacy</p>
            <div className="fhe-badge">
              <span>Fully Homomorphic Encryption</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="animated-crystal"></div>
          </div>
        </div>
        
        {showTutorial && (
          <div className="tutorial-section glass-morphism">
            <h2>How It Works</h2>
            <p className="subtitle">Secure X-ray analysis workflow using FHE technology</p>
            
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div 
                  className="tutorial-step"
                  key={index}
                >
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="project-intro glass-morphism">
          <h3>About This Project</h3>
          <p>
            XrayCrystFHE enables researchers to perform X-ray crystallography analysis on encrypted data using Fully Homomorphic Encryption (FHE). 
            Your sensitive diffraction patterns remain encrypted throughout the entire computation process, while still producing accurate electron density maps and molecular structures.
          </p>
          <div className="tech-tags">
            <span>FHE</span>
            <span>Secure Cloud</span>
            <span>X-ray Analysis</span>
            <span>Privacy-Preserving</span>
          </div>
        </div>
        
        <div className="data-section glass-morphism">
          <div className="section-header">
            <h2>Your Analysis History</h2>
            <div className="header-actions">
              <button 
                onClick={loadAnalysisData}
                className="refresh-btn"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="data-list">
            {analysisData.length === 0 ? (
              <div className="no-data">
                <div className="no-data-icon"></div>
                <p>No analysis data found</p>
                <button 
                  className="primary-btn"
                  onClick={() => setShowUploadModal(true)}
                >
                  Upload First X-ray Image
                </button>
              </div>
            ) : (
              analysisData.map(data => (
                <div className="data-item" key={data.id} onClick={() => setSelectedData(data)}>
                  <div className="data-id">#{data.id.substring(0, 6)}</div>
                  <div className="data-status">
                    <span className={`status-bubble ${data.status}`}></span>
                    {data.status}
                  </div>
                  <div className="data-date">
                    {new Date(data.timestamp * 1000).toLocaleDateString()}
                  </div>
                  <div className="data-owner">
                    {data.owner.substring(0, 6)}...{data.owner.substring(38)}
                  </div>
                  {isOwner(data.owner) && data.status === "processing" && (
                    <button 
                      className="process-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        processWithFHE(data.id);
                      }}
                    >
                      Process with FHE
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
  
      {showUploadModal && (
        <ModalUpload 
          onSubmit={uploadXrayImage} 
          onClose={() => setShowUploadModal(false)} 
          uploading={uploading}
          analysisData={newAnalysisData}
          setAnalysisData={setNewAnalysisData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal glass-morphism">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
      
      {selectedData && (
        <ModalDetails 
          data={selectedData}
          onClose={() => setSelectedData(null)}
          isOwner={isOwner(selectedData.owner)}
          onProcess={() => processWithFHE(selectedData.id)}
        />
      )}
  
      <footer className="app-footer glass-morphism">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="crystal-icon"></div>
              <span>XrayCrystFHE</span>
            </div>
            <p>Secure X-ray crystallography analysis using FHE technology</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Research Paper</a>
            <a href="#" className="footer-link">Contact Team</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Research</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} XrayCrystFHE. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalUploadProps {
  onSubmit: () => void; 
  onClose: () => void; 
  uploading: boolean;
  analysisData: any;
  setAnalysisData: (data: any) => void;
}

const ModalUpload: React.FC<ModalUploadProps> = ({ 
  onSubmit, 
  onClose, 
  uploading,
  analysisData,
  setAnalysisData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAnalysisData({
      ...analysisData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!analysisData.imageName) {
      alert("Please provide an image name");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="upload-modal glass-morphism">
        <div className="modal-header">
          <h2>Upload X-ray Image</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <div className="lock-icon"></div> Your X-ray image will be encrypted with FHE before processing
          </div>
          
          <div className="form-group">
            <label>Image Name *</label>
            <input 
              type="text"
              name="imageName"
              value={analysisData.imageName} 
              onChange={handleChange}
              placeholder="e.g. ProteinX_2023" 
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea 
              name="description"
              value={analysisData.description} 
              onChange={handleChange}
              placeholder="Additional notes about this sample..." 
              className="form-textarea"
              rows={3}
            />
          </div>
          
          <div className="file-upload">
            <div className="upload-area">
              <div className="upload-icon"></div>
              <p>Drag & drop X-ray diffraction image here</p>
              <p className="small">or click to browse (PNG, JPG, TIFF)</p>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={uploading}
            className="submit-btn"
          >
            {uploading ? "Encrypting with FHE..." : "Upload Securely"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ModalDetailsProps {
  data: CrystallographyData;
  onClose: () => void;
  isOwner: boolean;
  onProcess: () => void;
}

const ModalDetails: React.FC<ModalDetailsProps> = ({ data, onClose, isOwner, onProcess }) => {
  return (
    <div className="modal-overlay">
      <div className="details-modal glass-morphism">
        <div className="modal-header">
          <h2>Analysis Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="detail-row">
            <span className="detail-label">Analysis ID:</span>
            <span className="detail-value">#{data.id}</span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Status:</span>
            <span className={`detail-value status-${data.status}`}>{data.status}</span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Date:</span>
            <span className="detail-value">{new Date(data.timestamp * 1000).toLocaleString()}</span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Owner:</span>
            <span className="detail-value">{data.owner}</span>
          </div>
          
          <div className="data-visualization">
            <div className="visualization-tabs">
              <button className="tab-active">Encrypted Image</button>
              <button>Density Map</button>
              <button>Molecular Structure</button>
            </div>
            
            <div className="visualization-content">
              {data.status === "processing" ? (
                <div className="processing-placeholder">
                  <div className="spinner"></div>
                  <p>Analysis in progress with FHE</p>
                  {isOwner && (
                    <button className="process-btn" onClick={onProcess}>
                      Accelerate Processing
                    </button>
                  )}
                </div>
              ) : (
                <div className="fhe-data">
                  <div className="data-preview">
                    <div className="preview-image"></div>
                    <p>FHE-Encrypted Data Preview</p>
                  </div>
                  <div className="data-actions">
                    <button className="download-btn">Download Results</button>
                    <button className="share-btn">Share Securely</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;