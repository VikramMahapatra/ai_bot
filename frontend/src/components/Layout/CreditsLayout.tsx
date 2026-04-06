import React from "react";
import { Outlet } from "react-router-dom";
import { CreditsProvider } from "../../context/CreditsContext";

const CreditsLayout: React.FC = () => {
    return (
        <CreditsProvider>
            <Outlet />
        </CreditsProvider>
    );
};

export default CreditsLayout;