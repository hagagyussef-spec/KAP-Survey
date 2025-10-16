// KAP Survey JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('kapSurvey');
    const successMessage = document.getElementById('successMessage');
    const submitButton = form.querySelector('.btn-primary');

    // Form submission handler
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validate form
        if (!validateForm()) {
            return;
        }

        // Show loading state
        submitButton.classList.add('loading');
        submitButton.disabled = true;

        // Collect form data
        const formData = new FormData(form);
        const surveyData = {};
        
        for (let [key, value] of formData.entries()) {
            surveyData[key] = value;
        }

        // Add timestamp
        surveyData.timestamp = new Date().toISOString();

        // Log the survey data (in a real application, this would be sent to a server)
        console.log('Survey Data:', surveyData);

        // Simulate API call
        setTimeout(function() {
            // Hide form and show success message
            form.classList.add('hidden');
            successMessage.classList.remove('hidden');
            
            // Store data locally
            saveToLocalStorage(surveyData);
            
            // Reset button state
            submitButton.classList.remove('loading');
            submitButton.disabled = false;
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 1500);
    });

    // Form reset handler
    form.addEventListener('reset', function(e) {
        // Clear any error messages
        clearErrors();
        
        // Show confirmation
        if (!confirm('هل أنت متأكد من أنك تريد إعادة تعيين جميع الإجابات؟')) {
            e.preventDefault();
        }
    });

    // Real-time validation
    const requiredFields = form.querySelectorAll('[required]');
    requiredFields.forEach(field => {
        field.addEventListener('change', function() {
            validateField(this);
        });
    });

    // Validation functions
    function validateForm() {
        let isValid = true;
        clearErrors();

        requiredFields.forEach(field => {
            if (!validateField(field)) {
                isValid = false;
            }
        });

        if (!isValid) {
            alert('الرجاء ملء جميع الحقول المطلوبة');
            // Scroll to first error
            const firstError = form.querySelector('.error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        return isValid;
    }

    function validateField(field) {
        const question = field.closest('.question');
        
        // Check if it's a radio button group
        if (field.type === 'radio') {
            const radioGroup = document.querySelectorAll(`input[name="${field.name}"]`);
            const isChecked = Array.from(radioGroup).some(radio => radio.checked);
            
            if (!isChecked && field.required) {
                if (question) {
                    question.classList.add('error');
                }
                return false;
            } else {
                if (question) {
                    question.classList.remove('error');
                }
                return true;
            }
        }
        
        // Check other field types
        if (field.required && !field.value.trim()) {
            if (question) {
                question.classList.add('error');
            }
            return false;
        }
        
        if (question) {
            question.classList.remove('error');
        }
        return true;
    }

    function clearErrors() {
        const errors = form.querySelectorAll('.error');
        errors.forEach(error => {
            error.classList.remove('error');
        });
    }

    // Local storage functions
    function saveToLocalStorage(data) {
        try {
            // Get existing surveys
            let surveys = JSON.parse(localStorage.getItem('kapSurveys')) || [];
            
            // Add new survey
            surveys.push(data);
            
            // Save back to localStorage
            localStorage.setItem('kapSurveys', JSON.stringify(surveys));
            
            console.log('Survey saved to local storage');
        } catch (error) {
            console.error('Error saving to local storage:', error);
        }
    }

    // Add error styling
    const style = document.createElement('style');
    style.textContent = `
        .question.error {
            animation: shake 0.5s;
        }
        
        .question.error label {
            color: #dc3545;
        }
        
        .question.error select,
        .question.error input,
        .question.error textarea {
            border-color: #dc3545;
        }
        
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(style);

    // Auto-save functionality (optional)
    let autoSaveTimer;
    form.addEventListener('input', function() {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(function() {
            const formData = new FormData(form);
            const draftData = {};
            
            for (let [key, value] of formData.entries()) {
                draftData[key] = value;
            }
            
            // Save draft to localStorage
            localStorage.setItem('kapSurveyDraft', JSON.stringify(draftData));
            console.log('Draft auto-saved');
        }, 2000); // Save after 2 seconds of inactivity
    });

    // Load draft on page load
    function loadDraft() {
        try {
            const draft = JSON.parse(localStorage.getItem('kapSurveyDraft'));
            if (draft) {
                // Ask user if they want to load the draft
                if (confirm('تم العثور على مسودة سابقة. هل تريد استعادتها؟')) {
                    for (let [key, value] of Object.entries(draft)) {
                        const field = form.elements[key];
                        if (field) {
                            if (field.type === 'radio') {
                                const radio = form.querySelector(`input[name="${key}"][value="${value}"]`);
                                if (radio) radio.checked = true;
                            } else {
                                field.value = value;
                            }
                        }
                    }
                } else {
                    // Clear draft
                    localStorage.removeItem('kapSurveyDraft');
                }
            }
        } catch (error) {
            console.error('Error loading draft:', error);
        }
    }

    // Load draft on initialization
    loadDraft();

    // Clear draft after successful submission
    form.addEventListener('submit', function() {
        setTimeout(function() {
            localStorage.removeItem('kapSurveyDraft');
        }, 2000);
    });

    // Add smooth animations
    const sections = document.querySelectorAll('.survey-section');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeIn 0.6s ease forwards';
            }
        });
    }, { threshold: 0.1 });

    sections.forEach(section => {
        observer.observe(section);
    });
});
