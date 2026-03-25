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
  if (!value) return true;
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
  const amenitiesList = [];

  const tagsInput = document.getElementById("tagsInput");
  const tagEntry = document.getElementById("tagEntry");

  const amenitiesInput = document.getElementById("amenitiesInput");
  const amenityEntry = document.getElementById("amenityEntry");

  function saveDraft() {
    const draft = {
      name: document.getElementById("name")?.value || "",
      phone: document.getElementById("phone")?.value || "",
      address: document.getElementById("address")?.value || "",
      website: document.getElementById("website")?.value || "",
      description: document.getElementById("description")?.value || "",
      bestTime: document.getElementById("bestTime")?.value || "",
      notes: document.getElementById("notes")?.value || "",
      tags: [...tags],
      amenities: [...amenitiesList]
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

  function renderAmenities() {
    if (!amenitiesInput || !amenityEntry) return;

    document.querySelectorAll("#amenitiesInput .tag").forEach((tag) => tag.remove());

    amenitiesList.forEach((amenityText, index) => {
      const chip = document.createElement("span");
      chip.className = "tag";

      const label = document.createElement("span");
      label.textContent = amenityText;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "×";

      removeBtn.addEventListener("click", () => {
        amenitiesList.splice(index, 1);
        renderAmenities();
        saveDraft();
      });

      chip.appendChild(label);
      chip.appendChild(removeBtn);
      amenitiesInput.insertBefore(chip, amenityEntry);
    });
  }

  function loadDraft() {
    const draft = JSON.parse(sessionStorage.getItem("restaurantFormDraft") || "{}");

    const nameEl = document.getElementById("name");
    const phoneEl = document.getElementById("phone");
    const addressEl = document.getElementById("address");
    const websiteEl = document.getElementById("website");
    const descriptionEl = document.getElementById("description");
    const bestTimeEl = document.getElementById("bestTime");
    const notesEl = document.getElementById("notes");

    if (nameEl) nameEl.value = draft.name || "";
    if (phoneEl) phoneEl.value = draft.phone || "";
    if (addressEl) addressEl.value = draft.address || "";
    if (websiteEl) websiteEl.value = draft.website || "";
    if (descriptionEl) descriptionEl.value = draft.description || "";
    if (bestTimeEl) bestTimeEl.value = draft.bestTime || "";
    if (notesEl) notesEl.value = draft.notes || "";

    tags.length = 0;
    if (Array.isArray(draft.tags)) {
      tags.push(...draft.tags);
    }

    amenitiesList.length = 0;
    if (Array.isArray(draft.amenities)) {
      amenitiesList.push(...draft.amenities);
    }

    renderTags();
    renderAmenities();
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

  function addPendingAmenity() {
    if (!amenityEntry) return;

    const value = amenityEntry.value.trim();
    if (!value) return;

    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        if (!amenitiesList.includes(item)) {
          amenitiesList.push(item);
        }
      });

    amenityEntry.value = "";
    renderAmenities();
    saveDraft();
  }

  loadDraft();
  form.addEventListener("input", saveDraft);

  // ── Photo upload handling (mirrors review.js exactly) ──
  const MAX_PHOTOS  = 6;
  const MAX_BYTES   = 5 * 1024 * 1024;
  const selectedFiles = [];

  const uploadZone    = document.getElementById("restaurantUploadZone");
  const photoInput    = document.getElementById("restaurantPhotoInput");
  const photoPreviews = document.getElementById("restaurantPhotoPreviews");

  function renderPreviews() {
    photoPreviews.innerHTML = "";
    selectedFiles.forEach((file, idx) => {
      const url  = URL.createObjectURL(file);
      const item = document.createElement("div");
      item.className = "preview-item";
      item.innerHTML = `
        <img src="${url}" alt="Preview ${idx + 1}" />
        <button class="preview-remove" type="button" aria-label="Remove photo ${idx + 1}">×</button>
      `;
      item.querySelector(".preview-remove").addEventListener("click", () => {
        URL.revokeObjectURL(url);
        selectedFiles.splice(idx, 1);
        renderPreviews();
      });
      photoPreviews.appendChild(item);
    });

    const existing = photoPreviews.querySelector(".upload-count");
    if (existing) existing.remove();
    if (selectedFiles.length > 0) {
      const count = document.createElement("p");
      count.className = "upload-count";
      count.textContent = `${selectedFiles.length} / ${MAX_PHOTOS} photo${selectedFiles.length !== 1 ? "s" : ""} selected`;
      photoPreviews.appendChild(count);
    }
  }

  function addFiles(fileList) {
    const remaining = MAX_PHOTOS - selectedFiles.length;
    let skipped = 0;

    Array.from(fileList).slice(0, remaining).forEach((file) => {
      if (!file.type.startsWith("image/")) { skipped++; return; }
      if (file.size > MAX_BYTES)           { skipped++; return; }
      selectedFiles.push(file);
    });

    renderPreviews();
    photoInput.disabled = selectedFiles.length >= MAX_PHOTOS;
  }

  // Mirrors review.js exactly — input change fires when file is selected
  photoInput.addEventListener("change", (e) => {
    addFiles(e.target.files);
    photoInput.value = "";
  });

  // drag & drop
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("drag-over");
  });
  uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    addFiles(e.dataTransfer.files);
  });

  // keyboard accessibility
  uploadZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); photoInput.click(); }
  });

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

  if (amenityEntry) {
    amenityEntry.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addPendingAmenity();
      }

      if (e.key === "Backspace" && amenityEntry.value === "" && amenitiesList.length > 0) {
        amenitiesList.pop();
        renderAmenities();
        saveDraft();
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    addPendingTag();
    addPendingAmenity();
    clearErrors();
    setSubmitMessage("");

    const name        = document.getElementById("name")?.value.trim()        || "";
    const phone       = document.getElementById("phone")?.value.trim()       || "";
    const address     = document.getElementById("address")?.value.trim()     || "";
    const website     = document.getElementById("website")?.value.trim()     || "";
    const description = document.getElementById("description")?.value.trim() || "";
    const bestTime    = document.getElementById("bestTime")?.value.trim()    || "";
    const notes       = document.getElementById("notes")?.value.trim()       || "";
    const amenities   = amenitiesList.join(", ");

    // hours
    const mondayOpen     = document.getElementById("mondayOpen")?.value.trim()     || "";
    const mondayClose    = document.getElementById("mondayClose")?.value.trim()    || "";
    const tuesdayOpen    = document.getElementById("tuesdayOpen")?.value.trim()    || "";
    const tuesdayClose   = document.getElementById("tuesdayClose")?.value.trim()   || "";
    const wednesdayOpen  = document.getElementById("wednesdayOpen")?.value.trim()  || "";
    const wednesdayClose = document.getElementById("wednesdayClose")?.value.trim() || "";
    const thursdayOpen   = document.getElementById("thursdayOpen")?.value.trim()   || "";
    const thursdayClose  = document.getElementById("thursdayClose")?.value.trim()  || "";
    const fridayOpen     = document.getElementById("fridayOpen")?.value.trim()     || "";
    const fridayClose    = document.getElementById("fridayClose")?.value.trim()    || "";
    const saturdayOpen   = document.getElementById("saturdayOpen")?.value.trim()   || "";
    const saturdayClose  = document.getElementById("saturdayClose")?.value.trim()  || "";
    const sundayOpen     = document.getElementById("sundayOpen")?.value.trim()     || "";
    const sundayClose    = document.getElementById("sundayClose")?.value.trim()    || "";

    let isValid = true;

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
    if (website && !isValidUrl(website)) {
      document.getElementById("err-website").textContent = "Enter a valid website URL.";
      isValid = false;
    }

    if (!isValid) {
      saveDraft();
      setSubmitMessage("Please fix the highlighted fields.", "error");
      return;
    }

    function combineHours(open, close) {
      if (!open && !close) return null;
      return `${open},${close}`;
    }

    const payload = {
      restaurantName: name,
      phone:          digitsOnly(phone),
      address,
      website:        website || null,
      tags:           tags.join(", "),
      about:          description,
      amenities:      amenities || null,
      timeToVisit:    bestTime || null,
      notes:          notes || null,
      mondayHours:    combineHours(mondayOpen,    mondayClose),
      tuesdayHours:   combineHours(tuesdayOpen,   tuesdayClose),
      wednesdayHours: combineHours(wednesdayOpen, wednesdayClose),
      thursdayHours:  combineHours(thursdayOpen,  thursdayClose),
      fridayHours:    combineHours(fridayOpen,    fridayClose),
      saturdayHours:  combineHours(saturdayOpen,  saturdayClose),
      sundayHours:    combineHours(sundayOpen,    sundayClose)
    };

    try {
      const token = localStorage.getItem("jwtToken");

      // Build FormData exactly like review.js
      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));
      selectedFiles.forEach((file) => formData.append("photos", file));

      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: token } : {})
        },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        saveDraft();
        setSubmitMessage(data.message || "Failed to submit.", "error");
        return;
      }

      setSubmitMessage("Restaurant submitted successfully!", "success");

      form.reset();
      tags.length = 0;
      amenitiesList.length = 0;
      selectedFiles.length = 0;
      renderTags();
      renderAmenities();
      renderPreviews();
      sessionStorage.removeItem("restaurantFormDraft");
      clearErrors();

    } catch (err) {
      console.error("Frontend error:", err);
      saveDraft();
      setSubmitMessage("Server connection error.", "error");
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      form.reset();
      tags.length = 0;
      amenitiesList.length = 0;
      selectedFiles.length = 0;
      renderTags();
      renderAmenities();
      renderPreviews();
      clearErrors();
      setSubmitMessage("");
      sessionStorage.removeItem("restaurantFormDraft");
    });
  }
});