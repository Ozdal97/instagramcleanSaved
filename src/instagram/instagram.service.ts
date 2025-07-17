import { Injectable, Logger } from '@nestjs/common';
import puppeteer, { Browser, Page, ElementHandle } from 'puppeteer';

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  // Ana fonksiyon: Tarayıcıyı yönetir ve işlemi başlatır
  async loginAndDeleteSaved(username: string, password: string): Promise<void> {
    let browser: Browser | null = null;
    try {
      this.logger.log('Tarayıcı başlatılıyor...');
      browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page: Page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });

      // GİRİŞ ADIMLARI
      this.logger.log('Giriş yapılıyor...');
      await page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'networkidle2',
      });
      await page.waitForSelector('input[name="username"]');
      await page.type('input[name="username"]', username, { delay: 100 });
      await page.type('input[name="password"]', password, { delay: 100 });
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      // Silme işlemini ayrı bir metoda devret (Bu sizin iyi fikrinizdi)
      await this.deleteSaved(username, page);
    } catch (error) {
      // EĞER deleteSaved içinde düzeltilemeyecek BÜYÜK bir hata olursa,
      // burada yakalanır ve program sonsuz döngüye girmeden güvenle kapanır.
      this.logger.error(
        'İşlem sırasında genel ve kurtarılamaz bir hata oluştu:',
        error,
      );
    } finally {
      if (browser) {
        this.logger.log('Tarayıcı kapatılıyor...');
        // await browser.close();
      }
    }
  }

  // Sadece silme işlemine odaklanan metod
  async deleteSaved(username: string, page: Page): Promise<void> {
    // KAYDEDİLENLER SAYFASI
    this.logger.log('Kaydedilenler sayfasına gidiliyor...');
    await page.goto(`https://www.instagram.com/${username}/saved/all-posts/`, {
      waitUntil: 'networkidle2',
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Gerekli Seçiciler
    const postThumbnailSelector = 'div._aagw';
    const unsaveButtonSelectorInModal = 'svg[aria-label="Kaldır"]';
    const closeButtonSelectorInModal = 'svg[aria-label="Kapat"]';

    let unSavedCount = 0;
    this.logger.log(
      'Gönderi bazında hata yönetimi ile silme işlemi başlıyor...',
    );

    while (true) {
      const postToClick: ElementHandle<Element> | null = await page.$(
        postThumbnailSelector,
      );

      if (!postToClick) {
        this.logger.log(
          'Silinecek başka gönderi bulunamadı. İşlem tamamlandı.',
        );
        break;
      }

      // Hata yönetimi sadece burada, gönderi bazında yapılmalı.
      try {
        await postToClick.click();
        await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });
        this.logger.log('Gönderi açıldı. Durumu kontrol ediliyor...');

        await new Promise((resolve) => setTimeout(resolve, 500));

        const unsaveButtonHandle = await page.$(unsaveButtonSelectorInModal);

        if (unsaveButtonHandle) {
          await unsaveButtonHandle.click();
          unSavedCount++;
          this.logger.log(
            `"Kaldır" butonuna tıklandı. Toplam silinen: ${unSavedCount}`,
          );
        } else {
          this.logger.log('Gönderi "Kaydet" durumunda, atlanıyor.');
        }
        await new Promise((resolve) => setTimeout(resolve, 500));

        await page.waitForSelector(closeButtonSelectorInModal, {
          timeout: 5000,
        });
        await page.click(closeButtonSelectorInModal);
        this.logger.log('Pencere kapatıldı.');

        // Başarılı durumda gönderiyi DOM'dan sil.
        await page.evaluate((el) => el.remove(), postToClick);
        this.logger.log("İşlenen gönderi DOM'dan silindi.");
      } catch (error) {
        this.logger.error('Bir gönderiyi işlerken hata oluştu.', error.message);
        this.logger.log(
          'Hatalı gönderi bir sonraki döngüde denenmemesi için siliniyor...',
        );

        // TUTARLILIK: Hata durumunda da gönderiyi DOM'dan sil.
        await page.evaluate((el) => el.remove(), postToClick);

        const closeButton = await page.$(closeButtonSelectorInModal);
        if (closeButton) {
          await closeButton.click();
        }
      }
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 + Math.random() * 500),
      );
    }
  }
}
