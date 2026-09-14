import { react, useState } from "react";
import { HiMenu, HiX } from "react-icons/hi";

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    "Home",
    "Skin Scan",
    "Products",
    "Dermatologists",
  ];

  return (
    <header className="fixed top-0 left-0 w-full bg-[#F3CAB6] shadow-md z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-10 h-16 flex items-center justify-between">

        {/* Logo */}
        <h1 className="text-2xl font-bold text-[#DC926E]">
          DermaVision
        </h1>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link}
              href="#"
              className="text-gray-700 hover:text-[#DC926E] transition duration-300"
            >
              {link}
            </a>
          ))}

          <button className="bg-[#DC926E] text-white px-5 py-2 rounded-lg hover:bg-[#d57830] transition duration-300">
            Login
          </button>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-3xl text-[#DC926E]"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <HiX /> : <HiMenu />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {menuOpen && (
        <nav className="md:hidden bg-white shadow-md">
          <ul className="flex flex-col items-center gap-5 py-6">
            {navLinks.map((link) => (
              <li key={link}>
                <a
                  href="#"
                  className="text-gray-700 hover:text-pink-500"
                  onClick={() => setMenuOpen(false)}
                >
                  {link}
                </a>
              </li>
            ))}

            <li>
              <button className="bg-[#DC926E] text-white px-5 py-2 rounded-lg ">
                Login
              </button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
};

export default Header;