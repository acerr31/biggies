// public/js/editProfile.js

function digitsOnly(value) {
  return (value || "").toString().replace(/\D/g, "");
}

function formatPhoneForDisplay(digits) {
  if (!digits) return "";
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  return digits;
}

function setMessage(text, type = "error") {
  const el = document.getElementById("message");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("error", "success");
  el.classList.add(type);
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("jwtToken");
  if (!token) {
    window.location.href = "/";
    return;
  }

  const emailEl = document.getElementById("profile-email");
  const usernameEl = document.getElementById("edit-username");
  const firstNameEl = document.getElementById("edit-first-name");
  const lastNameEl = document.getElementById("edit-last-name");
  const phoneEl = document.getElementById("edit-phone");

  const saveBtn = document.getElementById("save-profile-btn");
  const cancelBtn = document.getElementById("cancel-btn");

  // Load existing profile
  try {
    const res = await fetch("/api/profile", {
      method: "GET",
      headers: {
        "Authorization": token, // RAW token (matches your middleware)
        "Content-Type": "application/json"
      }
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.message || "Failed to load profile.");
      return;
    }

    emailEl.textContent = data.email || "—";
    usernameEl.value = data.username || "";
    firstNameEl.value = data.first_name || "";
    lastNameEl.value = data.last_name || "";
    phoneEl.value = formatPhoneForDisplay(digitsOnly(data.phone_number || ""));

  } catch (err) {
    console.error(err);
    setMessage("Server connection error while loading profile.");
    return;
  }

  // Live phone formatting
  phoneEl.addEventListener("input", (e) => {
    const digits = digitsOnly(e.target.value).slice(0, 15);
    e.target.value = formatPhoneForDisplay(digits);
  });

  cancelBtn.addEventListener("click", () => {
    window.location.href = "/profile";
  });

  // Save changes
  saveBtn.addEventListener("click", async () => {
    const payload = {
      username: usernameEl.value.trim(),
      first_name: firstNameEl.value.trim(),
      last_name: lastNameEl.value.trim(),
      phone_number: digitsOnly(phoneEl.value.trim())
    };

    // basic validation (matches your earlier rules)
    if (!payload.username || !payload.first_name || !payload.last_name) {
      setMessage("Username, first name, and last name are required.");
      return;
    }
    if (payload.phone_number && !/^\d{10,15}$/.test(payload.phone_number)) {
      setMessage("Phone number must be 10–15 digits (numbers only).");
      return;
    }

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Authorization": token, // RAW token (matches your middleware)
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Failed to update profile.");
        return;
      }

      setMessage("Profile updated successfully!", "success");
      // optionally bounce back after save
      setTimeout(() => (window.location.href = "/profile"), 500);

    } catch (err) {
      console.error(err);
      setMessage("Server connection error while saving profile.");
    }
  });
});