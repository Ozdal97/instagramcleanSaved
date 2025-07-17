import { Injectable, Logger } from '@nestjs/common';
import puppeteer, { Browser, Page, ElementHandle } from 'puppeteer';

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  // Instagram'a giriş yapar ve ardından kayıtlı gönderileri silme işlemini başlatır
  async loginAndDeleteSaved(username: string, password: string): Promise<void> {
    let browser: Browser | null = null;

    try {
      this.logger.log('Tarayıcı başlatılıyor...');
      browser = await puppeteer.launch({
        headless: false, // Görsel olarak tarayıcıyı aç (debug için faydalı)
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page: Page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });

      // Giriş sayfasına git
      this.logger.log('Giriş yapılıyor...');
      await page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'networkidle2', // Sayfa tamamen yüklensin
      });

      // Giriş formunu doldur
      await page.waitForSelector('input[name="username"]');
      await page.type('input[name="username"]', username, { delay: 100 });
      await page.type('input[name="password"]', password, { delay: 100 });

      // Giriş butonuna tıkla ve yönlendirmeyi bekle
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      // Kaydedilen gönderileri silme işlemini başlat
      await this.deleteSaved(username, page);
    } catch (error) {
      // Ana işlem sırasında oluşabilecek beklenmedik hataları yakala
      this.logger.error(
        'İşlem sırasında genel ve kurtarılamaz bir hata oluştu:',
        error,
      );
    } finally {
      if (browser) {
        this.logger.log('Tarayıcı kapatılıyor...');
        // Tarayıcıyı kapatmak istersen yorum satırından çıkar
        await browser.close();
      }
    }
  }

  // Kullanıcının kayıtlı gönderilerini siler
  async deleteSaved(username: string, page: Page): Promise<void> {
    this.logger.log('Kaydedilenler sayfasına gidiliyor...');
    await page.goto(`https://www.instagram.com/${username}/saved/all-posts/`, {
      waitUntil: 'networkidle2',
    });

    // Sayfa yüklenmesini biraz bekle
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // DOM seçiciler
    const postThumbnailSelector = 'div._aagw';
    const unsaveButtonSelectorInModal = 'svg[aria-label="Kaldır"]';
    const closeButtonSelectorInModal = 'svg[aria-label="Kapat"]';

    let unSavedCount = 0;
    this.logger.log(
      'Gönderi bazında hata yönetimi ile silme işlemi başlıyor...',
    );

    // Tüm kayıtlı gönderiler silinene kadar döngü devam eder
    while (true) {
      const postToClick: ElementHandle<Element> | null = await page.$(
        postThumbnailSelector,
      );

      // Silinecek gönderi kalmamışsa döngüyü sonlandır
      if (!postToClick) {
        this.logger.log(
          'Silinecek başka gönderi bulunamadı. İşlem tamamlandı.',
        );
        break;
      }

      try {
        // Gönderiyi aç
        await postToClick.click();
        await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });
        this.logger.log('Gönderi açıldı. Durumu kontrol ediliyor...');

        await new Promise((resolve) => setTimeout(resolve, 500));

        // “Kaldır” butonunu bul
        const unsaveButtonHandle = await page.$(unsaveButtonSelectorInModal);

        if (unsaveButtonHandle) {
          // Kaydedilmişse kaldır
          await unsaveButtonHandle.click();
          unSavedCount++;
          this.logger.log(
            `"Kaldır" butonuna tıklandı. Toplam silinen: ${unSavedCount}`,
          );
        } else {
          this.logger.log('Gönderi "Kaydet" durumunda değil, atlanıyor.');
        }

        await new Promise((resolve) => setTimeout(resolve, 500));

        // Modal pencereyi kapat
        await page.waitForSelector(closeButtonSelectorInModal, {
          timeout: 5000,
        });
        await page.click(closeButtonSelectorInModal);
        this.logger.log('Pencere kapatıldı.');

        // DOM’dan işlenen gönderiyi kaldır
        await page.evaluate((el) => el.remove(), postToClick);
        this.logger.log("İşlenen gönderi DOM'dan silindi.");
      } catch (error) {
        // Bir gönderide hata oluşursa sadece o gönderiyi atla
        this.logger.error('Bir gönderiyi işlerken hata oluştu.', error.message);
        this.logger.log(
          'Hatalı gönderi bir sonraki döngüde denenmemesi için siliniyor...',
        );

        // Gönderiyi DOM'dan kaldır (hataya rağmen)
        await page.evaluate((el) => el.remove(), postToClick);

        // Eğer modal açıksa, kapatmayı dene
        const closeButton = await page.$(closeButtonSelectorInModal);
        if (closeButton) {
          await closeButton.click();
        }
      }

      // Bir sonraki gönderiye geçmeden kısa bir bekleme (daha insan gibi görünmesi için)
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 + Math.random() * 500),
      );
    }
  }
}
