import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import UserRegister from "./pages/UserRegister";
import Home from "./pages/Home";
import Header from "./components/Header";
import Footer from "./components/Footer";

const App = () => {
  return (
    <>
      <BrowserRouter>
        <Routes>
            <Route path="/" element={<Login />} />
           <Route path="/register" element={<UserRegister />} />
            <Route path="/home" element={<Home />} />
        </Routes>
      </BrowserRouter>
      {/* <Header />
      <main className="pt-16">
        <Home />
      </main>
      <Footer /> */}
    </>
  );
};

export default App;
