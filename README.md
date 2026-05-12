# Precision Liner Production Control Portal (V2.4.3)

A professional manufacturing execution and production control portal designed for real-time tracking of production metrics, quality yield, and overall equipment effectiveness (OEE). This application connects a dynamic frontend interface with a Smartsheet backend to provide a robust, enterprise-grade tracking solution.

## 🚀 Features

- **Real-Time KPI Dashboard**: Track Availability, Performance, Quality, and overall OEE in real-time throughout the shift.
- **Dynamic Lot Entry**: Interface for logging job details, sequence information, and part counts for individual lots.
- **Defect Tracking**: Granular defect logging with automated yield calculations and root cause analysis for low-yield scenarios.
- **PCD Tracker**: Hour-by-hour production control diagram (PCD) to monitor progress against shift goals.
- **Event Logging**: Track non-productive time (PTO, Meetings, Clean-Up, etc.) with integrated timers.
- **Shift Handover**: Notes and communication tools to ensure seamless transitions between shift associates.
- **Smartsheet Integration**: Automated data synchronization with Smartsheet for centralized reporting and analysis.

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, CSS3 (Modern UI with Glassmorphism), and JavaScript.
- **Backend**: Node.js with Express.js.
- **API Integration**: Axios for communicating with the Smartsheet API.
- **Environment Management**: Dotenv for secure handling of API credentials.
- **Version Control**: Git & GitHub.

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- [npm](https://www.npmjs.com/) (included with Node.js)
- A valid Smartsheet API Access Token.

## ⚙️ Setup Instructions

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Jbercegeay/Precision-Liner-Portal.git
   cd Precision-Liner-Portal
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add your Smartsheet configuration:
   ```env
   SMARTSHEET_ACCESS_TOKEN=your_access_token_here
   SMARTSHEET_SHEET_ID=your_sheet_id_here
   ```

4. **Run the Application**:
   Start the backend server:
   ```bash
   node server.js
   ```
   The application will be accessible at `http://localhost:3000`.

## 📂 Project Structure

- `server.js`: The central Express backend handling API routing and Smartsheet communication.
- `public/index.html`: The main application entry point and user interface.
- `scripts/`: various utility scripts for Smartsheet management.
- `.env`: (Local only) Secure environment configuration.

---
*Developed for Advanced Systems Analysis & Control.*
