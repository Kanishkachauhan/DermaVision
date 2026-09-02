import React from "react";
import Home from "./pages/Home";
import Header from "./components/Header";
import Footer from "./components/Footer";

const App = () => {
  return (
    <>
      <Header />
      <main className="pt-16">
        <Home />
      </main>
      <Footer />
    </>
  );
};

export default App;
