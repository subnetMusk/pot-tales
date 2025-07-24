in questa dir il gruppo B andrà a definire i contratti delle richieste agli endpoint di frontend

(se necessario verrà creata la dir anche per sandbox)

------------------------------------------------------------------------------------------------
degli esempi concreti, già implementati nel progetto, sul quale iniziare a lavorare sono:

/static/pages/

/sandbox/

/sandbox/frontend-assets/

/frontend-assets/

/sandbox-assets/

/static/
------------------------------------------------------------------------------------------------

Questi schemi (similmente a come ho fatto per server) serviranno al middleware del frontend per
validare le richieste in entrata e strutturare risposte standard in uscita.

È abbastanza autoesplicativo che in internal siano da definirsi gli schemi di comunicazione di
endpoint non accessibili dall'esterno (esempio: se vi saranno endpoint sul frontend per ricevere
richieste da server/sandbox) mentre in public quelli raggiungibili anche da browser (di cui
tutto il blocco sopra)