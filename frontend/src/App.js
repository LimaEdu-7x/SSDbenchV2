import { useState } from "react";
import "./App.css";
import { BrowserRouter } from "react-router-dom";
import SSDBenchApp from "./components/SSDBenchApp";

function App() {
  return (
    <div className="App scanlines">
      <BrowserRouter>
        <SSDBenchApp />
      </BrowserRouter>
    </div>
  );
}

export default App;
