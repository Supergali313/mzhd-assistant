/* Реквизиты дома — единый профиль, подставляемый во все документы */

window.PROFILE_FIELDS = [
  { id: 'orgForm',   label: 'Форма управления', type: 'select',
    options: ['ОСИ', 'КСК', 'Простое товарищество', 'Управляющая компания'], value: 'ОСИ' },
  { id: 'orgName',   label: 'Наименование объединения', placeholder: 'ОСИ «Достык-14»' },
  { id: 'bin',       label: 'БИН', placeholder: '000000000000' },
  { id: 'address',   label: 'Адрес дома', placeholder: 'г. Алматы, ул. Достык, д. 14' },
  { id: 'city',      label: 'Населённый пункт', placeholder: 'г. Алматы' },
  { id: 'totalArea', label: 'Общая полезная площадь дома, м²', type: 'number', placeholder: '5480.5' },
  { id: 'units',     label: 'Количество помещений (квартир)', type: 'number', placeholder: '96' },
  { id: 'chairman',  label: 'Председатель, Ф.И.О.', placeholder: 'Ахметов А. А.' },
  { id: 'manager',   label: 'Управляющий, Ф.И.О.', placeholder: 'Ахметов А. А.' },
  { id: 'accountant',label: 'Бухгалтер, Ф.И.О.', placeholder: 'Сериков С. С.' },
  { id: 'iik',       label: 'ИИК (текущий счёт)', placeholder: 'KZ00000000000000000' },
  { id: 'iikSave',   label: 'ИИК (сберегательный счёт)', placeholder: 'KZ00000000000000000' },
  { id: 'bank',      label: 'Банк, БИК', placeholder: 'АО «Банк», BIC XXXXKZKX' },
  { id: 'phone',     label: 'Телефон', placeholder: '+7 (700) 000-00-00' },
  { id: 'email',     label: 'E-mail', placeholder: 'osi@example.kz' },
  { id: 'office',    label: 'Место нахождения офиса / доска объявлений', placeholder: 'подъезд № 1, 1 этаж' }
];
