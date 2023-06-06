/*

This file holds the error messages for the API.

*/

module.exports = Object.freeze({
  DATABASE_ERROR: 'Isteginiz alinirken sunucuda bir hata olustu.',
  QUESTION_NOT_FOUND: 'Belirtilen soru sunucuda bulunamadi.',
  CONTACT_FORM_CREATED: 'Iletisim talebiniz basariyla alindi.',
  FEEDBACK_CANNOT_CREATED: 'Geri bildirim alinirken bir sorun olustu.',
  NO_TOPICS_IN_SUBCATEGORY: 'Bu alt kategoride hic konu yok.',
  NO_SUBCATEGORIES: 'Bu bilgilerle eslesen hicbir alt kategori bulunamadi.',
  EMAIL_OR_PASSWORD_INCORRECT: 'E-Mail ya da parola hatali.',
  EMAIL_REGISTERED_ANOTHER_PROVIDER:
    'Bu e-mail baska bir saglayici ile kayit olmus.',
  GOOGLE_AUTH_FAILED: 'Google ile giris yapilirken bir hata olustu.',
  APPLE_ID_NOT_FOUND:
    'Belirtilen Apple ID ile kayit olmus bir kullanici bulunamadi.',
  USER_CANNOT_BE_CREATED: 'Kullanici kaydolurken bir hata olustu.',
  USER_ALREADY_EXISTS: 'Bu email ile kayitli bir kullanici mevcut.',
  USER_NOT_FOUND: 'Belirtilen ID ile kayit olmus bir kullanici bulunamadi.',
  USER_CANNOT_UPDATED:
    'Belirtilen kullanicinin bilgileri guncellenirken bir hata olustu.',
  VERIFICATION_MAIL_SENT:
    'Belirtilen e-mail adresine aktivasyon maili gonderildi.',
  USER_ALREADY_ACTIVATED_ACCOUNT:
    'Belirtilen kullanici hesabini daha once aktif etmis.',
  PASSWORD_RESET_MAIL_SENT:
    'Parolama sifirlama baglantisi belirtilen mail adresine gonderildi.',
  PASSWORD_RESET_TOKEN_CANNOT_CREATED:
    'Parola sifirlama istegi olusturulurken bir hata meydana geldi.',
  PASSWORD_CANNOT_BE_SAME: 'Yeni parolaniz eski parolanizla ayni olamaz.',
  PASSWORD_CHANGED_SUCCESSFULLY: 'Parolaniz basariyla guncellendi.',
  PASSWORD_CANNOT_CHANGED: 'Parolaniz degistirilirken bir sorun olustu.',
  INVALID_OR_EXPIRED_TOKEN: 'Gecersiz ya da suresi dolmus istek.',
  ACCOUNT_DELETED_SUCCESSFULLT: 'Hesabiniz basariyla silindi.',
  USER_INFO_CANNOT_RETRIEVED: 'Kullanici bilgileri alinamadi.',
  USER_NAME_CANNOT_CHANGED_MORE_THAN_ONCE_MONTH:
    'Kullanici adi ayda bir kereden fazla degistirilemez.',
});
