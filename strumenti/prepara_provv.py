# prepara.py con un protagonista provvisorio (finché non c'è quello buono)
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import prepara as P
if not os.path.exists(os.path.join(P.ASSET, 'eroe.png')):
    P.FIGURE = [('scarti/' + sys.argv[1], 4, [('eroe_giu', 0), ('eroe_su', 1)], 2.5)]
os.makedirs(P.OUT, exist_ok=True)
e = {}
P.da_guida(e); P.fogli(e); P.figure(e); P.strisce(e); P.voga(e)
json.dump(e, open(os.path.join(P.OUT, 'elenco.json'), 'w'), indent=0)
print(len(e), 'sprite')
