// public/js/restaurantForm.js

console.log("restaurantForm.js file loaded");

function digitsOnly(value) {
  return (value || "").toString().replace(/\D/g, "");
}

function setSubmitMessage(text, type = "error") {
  const el = document.getElementById("submitResult");
  if (!el) return;

  el.textContent = text;
  el.classList.remove("error", "success");
  if (text) el.classList.add(type);
}

function clearErrors() {
  const errorIds = [
    "err-name",
    "err-phone",
    "err-address",
    "err-website",
    "err-tags",
    "err-description"
  ];

  errorIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

function clearTagError() {
  const errTags = document.getElementById("err-tags");
  if (errTags) errTags.textContent = "";
}

function isValidPhone(value) {
  const digits = digitsOnly(value);
  return digits.length >= 7 && digits.length <= 15;
}

function isValidUrl(value) {
  if (!value) return true; // optional field
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded fired");

  const form = document.getElementById("restaurantForm");
  const resetBtn = document.getElementById("resetBtn");

  if (!form) {
    console.log("Form not found");
    return;
  }

  const tags = [];
  const tagsInput = document.getElementById("tagsInput");
  const tagEntry = document.getElementById("tagEntry");

  function saveDraft() {
    const draft = {
      name: document.getElementById("name")?.value || "",
      phone: document.getElementById("phone")?.value || "",
      address: document.getElementById("address")?.value || "",
      website: document.getElementById("website")?.value || "",
      description: document.getElementById("description")?.value || "",
      amenities: document.getElementById("amenities")?.value || "",
      bestTime: document.getElementById("bestTime")?.value || "",
      notes: document.getElementById("notes")?.value || "",
      tags: [...tags]
    };

    sessionStorage.setItem("restaurantFormDraft", JSON.stringify(draft));
  }

  function renderTags() {
    if (!tagsInput || !tagEntry) return;

    document.querySelectorAll("#tagsInput .tag").forEach((tag) => tag.remove());

    tags.forEach((tagText, index) => {
      const chip = document.createElement("span");
      chip.className = "tag";

      const label = document.createElement("span");
      label.textContent = tagText;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "×";

      removeBtn.addEventListener("click", () => {
        tags.splice(index, 1);
        renderTags();
        saveDraft();
      });

      chip.appendChild(label);
      chip.appendChild(removeBtn);
      tagsInput.insertBefore(chip, tagEntry);
    });
  }

  function loadDraft() {
    const draft = JSON.parse(sessionStorage.getItem("restaurantFormDraft") || "{}");

    const nameEl = document.getElementById("name");
    const phoneEl = document.getElementById("phone");
    const addressEl = document.getElementById("address");
    const websiteEl = document.getElementById("website");
    const descriptionEl = document.getElementById("description");
    const amenitiesEl = document.getElementById("amenities");
    const bestTimeEl = document.getElementById("bestTime");
    const notesEl = document.getElementById("notes");

    if (nameEl) nameEl.value = draft.name || "";
    if (phoneEl) phoneEl.value = draft.phone || "";
    if (addressEl) addressEl.value = draft.address || "";
    if (websiteEl) websiteEl.value = draft.website || "";
    if (descriptionEl) descriptionEl.value = draft.description || "";
    if (amenitiesEl) amenitiesEl.value = draft.amenities || "";
    if (bestTimeEl) bestTimeEl.value = draft.bestTime || "";
    if (notesEl) notesEl.value = draft.notes || "";

    tags.length = 0;
    if (Array.isArray(draft.tags)) {
      tags.push(...draft.tags);
    }

    renderTags();
  }

  function addPendingTag() {
    if (!tagEntry) return;

    const value = tagEntry.value.trim();
    if (!value) return;

    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        if (!tags.includes(item)) {
          tags.push(item);
        }
      });

    tagEntry.value = "";
    renderTags();
    clearTagError();
    saveDraft();
  }

  loadDraft();
  form.addEventListener("input", saveDraft);

  if (tagEntry) {
    tagEntry.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addPendingTag();
      }

      if (e.key === "Backspace" && tagEntry.value === "" && tags.length > 0) {
        tags.pop();
        renderTags();
        saveDraft();
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    addPendingTag();
    clearErrors();
    setSubmitMessage("");

    const name = document.getElementById("name")?.value.trim() || "";
    const phone = document.getElementById("phone")?.value.trim() || "";
    const address = document.getElementById("address")?.value.trim() || "";
    const website = document.getElementById("website")?.value.trim() || "";
    const description = document.getElementById("description")?.value.trim() || "";
    const amenities = document.getElementById("amenities")?.value.trim() || "";
    const bestTime = document.getElementById("bestTime")?.value.trim() || "";
    const notes = document.getElementById("notes")?.value.trim() || "";

    let isValid = true;

    // required
    if (!name) {
      document.getElementById("err-name").textContent = "Name is required.";
      isValid = false;
    }

    if (!phone) {
      document.getElementById("err-phone").textContent = "Phone is required.";
      isValid = false;
    } else if (!isValidPhone(phone)) {
      document.getElementById("err-phone").textContent = "Enter a valid phone number.";
      isValid = false;
    }

    if (!address) {
      document.getElementById("err-address").textContent = "Address is required.";
      isValid = false;
    }

    if (!description) {
      document.getElementById("err-description").textContent = "Description is required.";
      isValid = false;
    }

    if (tags.length < 1) {
      document.getElementById("err-tags").textContent = "Add at least one tag.";
      isValid = false;
    }

    // optional
    if (website && !isValidUrl(website)) {
      document.getElementById("err-website").textContent = "Enter a valid website URL.";
      isValid = false;
    }

    if (!isValid) {
      saveDraft(); // keep everything in case page changes/reloads later
      setSubmitMessage("Please fix the highlighted fields.", "error");
      return;
    }

    const payload = {
      restaurantName: name,
      phone: digitsOnly(phone),
      address,
      website: website || null,
      tags: tags.join(", "),
      about: description,
      amenities: amenities || null,
      timeToVisit: bestTime || null,
      notes: notes || null
    };

    try {
      const token = localStorage.getItem("jwtToken");

      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: token } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        saveDraft(); // preserve data on backend error
        setSubmitMessage(data.message || "Failed to submit.", "error");
        return;
      }

      setSubmitMessage("Restaurant submitted successfully!", "success");

      form.reset();
      tags.length = 0;
      renderTags();
      sessionStorage.removeItem("restaurantFormDraft");
      clearErrors();

    } catch (err) {
      console.error("Frontend error:", err);
      saveDraft(); // preserve data on network error
      setSubmitMessage("Server connection error.", "error");
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      form.reset();
      tags.length = 0;
      renderTags();
      clearErrors();
      setSubmitMessage("");
      sessionStorage.removeItem("restaurantFormDraft");
    });
  }
});