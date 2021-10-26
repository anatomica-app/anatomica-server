$(document).ready(function () {

    let pagePath = window.location.pathname;
    let paths = pagePath.split('/');

    let id = paths[5];
    let token = paths[6];

    $("#reset-password-form").submit(function (event) {
        event.preventDefault();

        const password1 = $('#password').val();
        const password2 = $('#password-again').val();

        // Let's check if the passwords match.

        if (password1 !== password2) {
            // Password mismatch.
            $.toast({ 
                heading: 'Uyarı',
                text : 'Parolalar birbiriyle uyuşmuyor. Lütfen kontrol ediniz.', 
                showHideTransition : 'fade',
                bgColor : '#EDB95E',
                textColor : '#fff',
                allowToastClose : true,
                hideAfter : 5000,
                stack : 5,
                textAlign : 'left',
                position : 'top-right',
                icon: 'error',
                loader: false
            });   
        }else {
            // Passwords match.
            // Let's check if password is longer than 6 characters.

            if (password1.length > 6){
                // Password is okay.
                let loading = loadingOverlay().activate();
                let apiPrefix = "https://anatomica-scx43dzaka-ew.a.run.app/v1/";
    
                const data = {
                    id: id,
                    token: token,
                    password: password1
                }
    
                $.ajax({
                    url: apiPrefix + "users/password/update/",
                    method: "PUT",
                    headers: {
                        Accept: "application/json, text/plain, */*",
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + token,
                    },
                    data: JSON.stringify(data),
                    success: function (json) {
                        loadingOverlay().cancel(loading);
                        if (json.error !== true) {
                            location.replace("./page_templates/password_changed.html");
                        }else {
                            $.toast({ 
                                heading: 'Hata',
                                text : json.message, 
                                showHideTransition : 'fade',
                                bgColor : '#FF0033',
                                textColor : '#fff',
                                allowToastClose : true,
                                hideAfter : 5000,
                                stack : 5,
                                textAlign : 'left',
                                position : 'top-right',
                                icon: 'error',
                                loader: false
                            });
                        }
                    },
                    error: function(request,status,errorThrown) {
                        loadingOverlay().cancel(loading);
                        $.toast({ 
                            heading: 'Hata',
                            text : 'Beklenmedik bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.', 
                            showHideTransition : 'fade',
                            bgColor : '#FF0033',
                            textColor : '#fff',
                            allowToastClose : true,
                            hideAfter : 5000,
                            stack : 5,
                            textAlign : 'left',
                            position : 'top-right',
                            icon: 'error',
                            loader: false
                        });
                    }
                });
            }else {
                $.toast({ 
                    heading: 'Uyarı',
                    text : 'Parolanız 6 karakterden daha uzun olmalıdır.', 
                    showHideTransition : 'fade',
                    bgColor : '#EDB95E',
                    textColor : '#fff',
                    allowToastClose : true,
                    hideAfter : 5000,
                    stack : 5,
                    textAlign : 'left',
                    position : 'top-right',
                    icon: 'error',
                    loader: false
                });   
            }
        }
    });
});