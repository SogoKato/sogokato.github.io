---
title: "AnsibleでPostfixをセットアップする"
date: "2024-09-30"
tags: ["Ansible", "Postfix"]
---

Ansible で postfix をインストールして、各種設定ファイルを流し込む role の例です。

`tasks/main.yml`

```yaml
- name: Update apt package list
  ansible.builtin.apt:
    update_cache: yes
  when: ansible_distribution == 'Debian' or ansible_distribution == 'Ubuntu'

- name: Ensure postfix is installed
  ansible.builtin.package:
    name: postfix
    state: present

- name: Put main.cf
  ansible.builtin.template:
    src: main.cf
    dest: /etc/postfix/main.cf

- name: Put sasl_passwd
  ansible.builtin.template:
    src: sasl_passwd
    dest: /etc/postfix/sasl_passwd

- name: Generate sasl_passwd.db
  ansible.builtin.command: postmap /etc/postfix/sasl_passwd

- name: Change permission of sasl_passwd.db
  ansible.builtin.file:
    path: /etc/postfix/sasl_passwd.db
    mode: "600"

- name: Remove sasl_passwd
  ansible.builtin.file:
    path: /etc/postfix/sasl_passwd
    state: absent

- name: Restart postfix
  ansible.builtin.service:
    name: postfix
    state: restarted
```

`templates/main.cf`

```conf
relayhost = example.com:587
smtp_sasl_auth_enable = yes
smtp_sasl_security_options = noanonymous
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
smtp_use_tls = yes
smtp_tls_security_level = encrypt
smtp_tls_note_starttls_offer = yes
```

`templates/sasl_passwd`

```
example.com:587 {{ smtp_username }}:{{ smtp_password }}
```

その他設定ファイルが必要な場合は、`ansible.builtin.template` 等を利用して追加すれば OK。

## 参考文献

* [geerlingguy/ansible-role-postfix: Ansible Role - Postfix](https://github.com/geerlingguy/ansible-role-postfix/tree/master)
