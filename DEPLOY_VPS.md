## Detectado: EasyPanel (Docker) 🐳
Como seu servidor já tem o EasyPanel, ele já ocupa a porta 80. Por isso, **não vamos usar o Nginx manual** para evitar conflitos. Vamos usar o EasyPanel para gerenciar tudo!

### Passo 1: Limpar a instalação manual
Como o Nginx manual deu erro, vamos removê-lo:
```bash
apt remove nginx -y && apt autoremove -y
```

### Opção 1: Upload Manual (Mais Rápido Agora) 📁
Como você não está usando GitHub, vamos enviar os arquivos direto do seu computador para o servidor.

#### 1. Gerar os arquivos de produção
No seu terminal local (aqui no VS Code), rode:
```bash
npm run build
```
Isso vai criar uma pasta chamada `dist`. Tudo o que está dentro dela é o que vai para o servidor.

#### 2. Enviar via SCP (Terminal)
Rode este comando (substitua pelo IP `31.97.170.6`):
```bash
scp -r dist/* root@31.97.170.6:/var/www/html/
```

#### 3. Ou usar o FileZilla (Visual)
- Baixe o [FileZilla](https://filezilla-project.org/).
- Conecte no IP `31.97.170.6`, usuário `root` e sua senha.
- Arraste tudo o que está dentro da pasta `dist` para a pasta `/var/www/html/` no servidor.

## Configurando o Nginx (Importante para React Router)

Edite o arquivo de configuração:
```bash
sudo nano /etc/nginx/sites-available/default
```

Certifique-se de que a seção `location /` esteja assim:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Reinicie o Nginx:
```bash
sudo systemctl restart nginx
```

## Dica: EasyPanel 💎
Vi que você tem o **EasyPanel** instalado (Botão roxo "Gerenciar painel"). Ele é excelente! 
- Se você preferir, pode clicar lá e conectar seu GitHub. Ele faz o deploy e coloca o SSL (https) automaticamente para você, sem precisar de comandos.

---
> [!IMPORTANT]
> Seu IP é **31.97.170.6**. Use o usuário **root** para se conectar.
