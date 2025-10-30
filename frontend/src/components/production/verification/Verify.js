import React, { useState, useEffect, useRef, useCallback } from 'react';
import VerificationForm from './VerificationForm';
import VerifyTable from './VerifyTable';
import RightDetails from '../../utils/RightDetails';
import '../../../pages/utilities/Utilities.css';

const Verify = () => {
    const [view, setView] = useState('table');
    const [isLargeScreen, setIsLargeScreen] = useState(false);
    const [rightPanelData, setRightPanelData] = useState(null);
    const verifyTableRef = useRef(null);
    
    // Check screen size on mount and resize
    useEffect(() => {
        const checkScreenSize = () => {
            setIsLargeScreen(window.innerWidth >= 1200);
        };
        
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    const handleOpenRightPanel = useCallback((data) => {
        setRightPanelData(data);
    }, []);

    const handleCloseRightPanel = useCallback(() => {
        setRightPanelData(null);
    }, []);

    const handleRightPanelSave = useCallback(async () => {
        // Close the panel and refresh the table data
        setRightPanelData(null);
        
        // Trigger a data refresh in the VerifyTable if it has a refresh method
        if (verifyTableRef.current && verifyTableRef.current.refreshData) {
            await verifyTableRef.current.refreshData();
        }
    }, []);
    
    if (isLargeScreen) {
        // Full-width table layout for large screens
        return (
            <div className="settings-content-wrapper">
                <div style={{ 
                    minHeight: '600px',
                    width: '100%'
                }}>
                    {/* Table Section - Full Width */}
                    <div style={{ 
                        width: '100%',
                        padding: '20px',
                        borderRadius: '8px',
                        overflowY: 'auto'
                    }}>
                        <VerifyTable 
                            ref={verifyTableRef}
                            onOpenRightPanel={handleOpenRightPanel} 
                        />
                    </div>

                    {/* Right Details Panel - Slides in from right */}
                    {rightPanelData && (
                        <RightDetails
                            data={rightPanelData}
                            onSave={handleRightPanelSave}
                            onClose={handleCloseRightPanel}
                            fromPage="Verification"
                        />
                    )}
                </div>
            </div>
        );
    }
    
    // Mobile layout - table-focused with modal forms
    return (
        <div className="settings-content-wrapper">


            <div className="settings-content-body">
                <VerifyTable 
                    ref={verifyTableRef}
                    onOpenRightPanel={handleOpenRightPanel} 
                />
                
                {/* Mobile-optimized panel that slides up from bottom on mobile, slides in from right on tablet */}
                {rightPanelData && (
                    <RightDetails
                        data={rightPanelData}
                        onSave={handleRightPanelSave}
                        onClose={handleCloseRightPanel}
                        fromPage="Verification"
                        isMobile={true}
                    />
                )}
            </div>
        </div>
    );
};

export default Verify; 