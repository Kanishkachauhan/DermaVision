# 🌿 DermaVision: AI-Powered Skin Analysis and Skincare Recommendation System

## 📌 Overview

DermaVision is an AI-powered web application that analyzes facial skin images to identify common skin concerns such as acne, pigmentation, dark spots, blackheads, enlarged pores, redness, and skin type. Based on the analysis, the system provides personalized skincare recommendations, generates a detailed skin health report, and helps users locate nearby dermatologists for professional consultation.

This project combines **Artificial Intelligence, Computer Vision, and Full-Stack Web Development** to provide an intelligent and user-friendly skincare solution.

---

## ✨ Key Features

* 🔍 AI-Based Skin Analysis
* 🧴 Personalized Skincare Product Recommendations
* 📄 Skin Health Report Generation
* 📍 Nearby Dermatologist Finder
* 🩺 Admin-managed dermatologist profiles
* 📈 Skin Progress Tracking & Analysis History

---

## 🛠️ Tech Stack

### Frontend

* React.js
* Tailwind CSS
* Axios

### Backend

* Node.js
* Express.js

### Database

* MongoDB Atlas

### AI & Machine Learning

* Python
* TensorFlow / Keras
* OpenCV
* NumPy
* Pandas

### Authentication

* JWT
* bcrypt

### Version Control

* Git
* GitHub

---

## 📂 Project Structure

```text
DermaVision/
│
├── client/                 # React Frontend
├── server/                 # Node.js Backend
├── ai-model/               # AI Model & Training
├── docs/                   # Documentation
├── README.md
└── .gitignore
```

---

## 🚀 Development Workflow

1. Collect and preprocess skin image datasets.
2. Train the AI model for skin analysis.
3. Develop the backend APIs.
4. Build the React frontend.
5. Integrate AI model with the web application.
6. Test and deploy the complete system.

## 🩺 Doctor Directory

The public doctor listing is served from MongoDB at `GET /api/doctors` and contains active profiles only. Administrators with the existing `admin` user role can manage profiles at `/admin/doctors`; the API is protected by the existing JWT middleware. Admin accounts must be provisioned through a trusted process; public registration does not grant administrator privileges.

To insert the initial Derma With Me profile, run this once from the `Backend` directory:

```sh
npm run seed:doctors
```

The seed command is idempotent and uses the configured `MONGO_URI`. Additional profiles can be managed from the admin page without frontend code changes.

---

## 👥 Team Collaboration

* Use feature branches for development.
* Pull the latest changes before starting work.
* Create meaningful commit messages.
* Push changes regularly.
* Review code before merging into the main branch.

---

## 📄 Project Status

🚧 Currently in Development

---

## 📜 License

This project is developed for academic purposes as a Major Project.
