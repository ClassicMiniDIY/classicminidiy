<script lang="ts" setup>
  import { SocialItems } from '../../data/models/generic';

  const { t } = useI18n({
    messages: {
      en: {
        brand_name: 'Classic Mini DIY',
        author_name: 'Cole Gentry',
        youtube_link_aria: 'Link to my youtube channel',
        description:
          'The Classic Mini DIY toolbox is a passion project aligned with the Classic Mini DIY youtube channel. This is a completely free resource built to keep the Classic Mini technical knowledge base alive for years to come. Regularly updated and community fed data made to help Classic Mini owners around the world.',
        company_name: 'Classic Mini DIY LLC',
        contact_link: 'Contact',
        links_divider: 'Links',
        privacy_links: {
          cmdiy_privacy: 'CMDIY Site Privacy Policy',
          youtube_privacy: 'Youtube Privacy Policy',
          google_privacy: 'Google Privacy Policy',
        },
      },
      es: {
        brand_name: 'Classic Mini DIY',
        author_name: 'Cole Gentry',
        youtube_link_aria: 'Enlace a mi canal de youtube',
        description:
          'La caja de herramientas Classic Mini DIY es un proyecto de pasión alineado con el canal de youtube Classic Mini DIY. Este es un recurso completamente gratuito construido para mantener viva la base de conocimiento técnico del Classic Mini por años venideros. Datos actualizados regularmente y alimentados por la comunidad hechos para ayudar a propietarios de Classic Mini en todo el mundo.',
        company_name: 'Classic Mini DIY LLC',
        contact_link: 'Contacto',
        links_divider: 'Enlaces',
        privacy_links: {
          cmdiy_privacy: 'Política de Privacidad del Sitio CMDIY',
          youtube_privacy: 'Política de Privacidad de Youtube',
          google_privacy: 'Política de Privacidad de Google',
        },
      },
      fr: {
        brand_name: 'Classic Mini DIY',
        author_name: 'Cole Gentry',
        youtube_link_aria: 'Lien vers ma chaîne youtube',
        description:
          "La boîte à outils Classic Mini DIY est un projet de passion aligné avec la chaîne youtube Classic Mini DIY. C'est une ressource complètement gratuite construite pour maintenir vivante la base de connaissances techniques du Classic Mini pour les années à venir. Données régulièrement mises à jour et alimentées par la communauté faites pour aider les propriétaires de Classic Mini dans le monde entier.",
        company_name: 'Classic Mini DIY LLC',
        contact_link: 'Contact',
        links_divider: 'Liens',
        privacy_links: {
          cmdiy_privacy: 'Politique de Confidentialité du Site CMDIY',
          youtube_privacy: 'Politique de Confidentialité Youtube',
          google_privacy: 'Politique de Confidentialité Google',
        },
      },
      de: {
        brand_name: 'Classic Mini DIY',
        author_name: 'Cole Gentry',
        youtube_link_aria: 'Link zu meinem Youtube-Kanal',
        description:
          'Die Classic Mini DIY Toolbox ist ein Leidenschaftsprojekt, das mit dem Classic Mini DIY Youtube-Kanal abgestimmt ist. Dies ist eine völlig kostenlose Ressource, die entwickelt wurde, um die technische Wissensbasis des Classic Mini für die kommenden Jahre am Leben zu erhalten. Regelmäßig aktualisierte und von der Community gespeiste Daten, die Classic Mini-Besitzern auf der ganzen Welt helfen sollen.',
        company_name: 'Classic Mini DIY LLC',
        contact_link: 'Kontakt',
        links_divider: 'Links',
        privacy_links: {
          cmdiy_privacy: 'CMDIY Website Datenschutzrichtlinie',
          youtube_privacy: 'Youtube Datenschutzrichtlinie',
          google_privacy: 'Google Datenschutzrichtlinie',
        },
      },
      it: {
        brand_name: 'Classic Mini DIY',
        author_name: 'Cole Gentry',
        youtube_link_aria: 'Link al mio canale youtube',
        description:
          'La cassetta degli attrezzi Classic Mini DIY è un progetto di passione allineato con il canale youtube Classic Mini DIY. Questa è una risorsa completamente gratuita costruita per mantenere viva la base di conoscenze tecniche del Classic Mini per gli anni a venire. Dati regolarmente aggiornati e alimentati dalla comunità fatti per aiutare i proprietari di Classic Mini in tutto il mondo.',
        company_name: 'Classic Mini DIY LLC',
        contact_link: 'Contatto',
        links_divider: 'Collegamenti',
        privacy_links: {
          cmdiy_privacy: 'Politica sulla Privacy del Sito CMDIY',
          youtube_privacy: 'Politica sulla Privacy di Youtube',
          google_privacy: 'Politica sulla Privacy di Google',
        },
      },
      ja: {
        brand_name: 'Classic Mini DIY',
        author_name: 'Cole Gentry',
        youtube_link_aria: '私のyoutubeチャンネルへのリンク',
        description:
          'Classic Mini DIYツールボックスは、Classic Mini DIY youtubeチャンネルと連携した情熱プロジェクトです。これは、Classic Miniの技術知識ベースを今後何年も生き続けさせるために構築された完全に無料のリソースです。定期的に更新され、コミュニティによって供給されるデータは、世界中のClassic Miniオーナーを支援するために作られています。',
        company_name: 'Classic Mini DIY LLC',
        contact_link: 'お問い合わせ',
        links_divider: 'リンク',
        privacy_links: {
          cmdiy_privacy: 'CMDIYサイトプライバシーポリシー',
          youtube_privacy: 'Youtubeプライバシーポリシー',
          google_privacy: 'Googleプライバシーポリシー',
        },
      },
      ko: {
        brand_name: 'Classic Mini DIY',
        author_name: 'Cole Gentry',
        youtube_link_aria: '내 유튜브 채널 링크',
        description:
          'Classic Mini DIY 도구상자는 Classic Mini DIY 유튜브 채널과 연계된 열정 프로젝트입니다. 이것은 앞으로 몇 년 동안 Classic Mini 기술 지식 기반을 살아있게 유지하기 위해 구축된 완전히 무료 리소스입니다. 정기적으로 업데이트되고 커뮤니티에서 제공하는 데이터로 전 세계 Classic Mini 소유자들을 돕기 위해 만들어졌습니다.',
        company_name: 'Classic Mini DIY LLC',
        contact_link: '연락처',
        links_divider: '링크',
        privacy_links: {
          cmdiy_privacy: 'CMDIY 사이트 개인정보 보호정책',
          youtube_privacy: 'Youtube 개인정보 보호정책',
          google_privacy: 'Google 개인정보 보호정책',
        },
      },
      pt: {
        brand_name: 'Classic Mini DIY',
        author_name: 'Cole Gentry',
        youtube_link_aria: 'Link para meu canal do youtube',
        description:
          'A caixa de ferramentas Classic Mini DIY é um projeto de paixão alinhado com o canal do youtube Classic Mini DIY. Este é um recurso completamente gratuito construído para manter viva a base de conhecimento técnico do Classic Mini por anos vindouros. Regularmente atualizado e dados alimentados pela comunidade feitos para ajudar proprietários de Classic Mini em todo o mundo.',
        company_name: 'Classic Mini DIY LLC',
        contact_link: 'Contato',
        links_divider: 'Links',
        privacy_links: {
          cmdiy_privacy: 'Política de Privacidade do Site CMDIY',
          youtube_privacy: 'Política de Privacidade do Youtube',
          google_privacy: 'Política de Privacidade do Google',
        },
      },
      ru: {
        brand_name: 'Classic Mini DIY',
        author_name: 'Cole Gentry',
        youtube_link_aria: 'Ссылка на мой канал youtube',
        description:
          'Набор инструментов Classic Mini DIY - это проект страсти, согласованный с каналом youtube Classic Mini DIY. Это полностью бесплатный ресурс, созданный для поддержания базы технических знаний Classic Mini на годы вперед. Регулярно обновляемые и подпитываемые сообществом данные, созданные для помощи владельцам Classic Mini по всему миру.',
        company_name: 'Classic Mini DIY LLC',
        contact_link: 'Контакт',
        links_divider: 'Ссылки',
        privacy_links: {
          cmdiy_privacy: 'Политика конфиденциальности сайта CMDIY',
          youtube_privacy: 'Политика конфиденциальности Youtube',
          google_privacy: 'Политика конфиденциальности Google',
        },
      },
      zh: {
        brand_name: 'Classic Mini DIY',
        author_name: 'Cole Gentry',
        youtube_link_aria: '我的youtube频道链接',
        description:
          'Classic Mini DIY工具箱是与Classic Mini DIY youtube频道一致的激情项目。这是一个完全免费的资源，旨在让Classic Mini技术知识库在未来几年保持活力。定期更新和社区提供的数据，旨在帮助世界各地的Classic Mini车主。',
        company_name: 'Classic Mini DIY LLC',
        contact_link: '联系我们',
        links_divider: '链接',
        privacy_links: {
          cmdiy_privacy: 'CMDIY网站隐私政策',
          youtube_privacy: 'Youtube隐私政策',
          google_privacy: 'Google隐私政策',
        },
      },
    },
  });
  const socials = ref(SocialItems);
</script>

<template>
  <footer class="bg-neutral-100 dark:bg-[#171717] py-10 text-center">
    <div class="container mx-auto px-4">
      <!-- Social Links -->
      <div class="pb-4">
        <div class="flex justify-center gap-2">
          <UButton
            v-for="(social, i) in socials"
            :key="i"
            :to="social.href"
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            color="neutral"
            size="lg"
            square
            :title="social.title"
          >
            <i :class="social.icon" class="text-2xl"></i>
          </UButton>
        </div>
      </div>

      <!-- Brand Info -->
      <div class="pt-0">
        <h2 class="text-xl font-semibold">
          <strong class="text-primary">{{ t('brand_name') }}</strong> by
          <ULink
            to="https://youtube.com/c/classicminidiy?sub_confirmation=1"
            target="_blank"
            rel="noopener"
            :aria-label="t('youtube_link_aria')"
            class="hover:underline"
          >
            {{ t('author_name') }}</ULink
          >.
        </h2>
        <p class="pb-3 max-w-3xl mx-auto mt-2 text-muted">
          {{ t('description') }}
        </p>
      </div>

      <!-- Copyright and Links -->
      <div>
        <div class="flex justify-center">
          <div class="w-10/12">
            <p class="text-muted">
              {{ new Date().getFullYear() }} — <strong>{{ t('company_name') }}</strong>
            </p>

            <USeparator class="my-4" :label="t('links_divider')" />

            <div class="flex flex-wrap justify-center gap-3">
              <ULink to="/contact" class="text-sm hover:underline">
                {{ t('contact_link') }}
              </ULink>
              <ULink to="/privacy" class="text-sm hover:underline">
                {{ t('privacy_links.cmdiy_privacy') }}
              </ULink>
              <ULink
                to="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm hover:underline"
              >
                {{ t('privacy_links.youtube_privacy') }}
              </ULink>
              <ULink
                to="http://www.google.com/policies/privacy"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm hover:underline"
              >
                {{ t('privacy_links.google_privacy') }}
              </ULink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>
