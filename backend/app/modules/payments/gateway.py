"""SSLCOMMERZ hosted checkout. Browser returns are NOT a payment authority."""
from decimal import Decimal,InvalidOperation
from urllib.parse import urljoin
import httpx
from ...core.config import settings
from ...core.errors import fail

class Gateway:
    def __init__(self):
        self.cfg=settings()
        if not self.cfg.sslcommerz_store_id or not self.cfg.sslcommerz_store_password:
            fail(503,'Payment merchant not configured')
        self.base='https://securepay.sslcommerz.com' if self.cfg.sslcommerz_mode=='live' else 'https://sandbox.sslcommerz.com'
    def start(self,reference:str,amount:int,person:dict):
        api=self.cfg.public_base_url.rstrip('/')+'/api/payments/sslcommerz/'
        payload={
            'store_id':self.cfg.sslcommerz_store_id,'store_passwd':self.cfg.sslcommerz_store_password,
            'total_amount':str(amount),'currency':'BDT','tran_id':reference,
            'success_url':api+'return','fail_url':api+'return','cancel_url':api+'return','ipn_url':api+'ipn',
            'shipping_method':'NO','product_name':'Trippy monthly seat','product_category':'Transport service',
            'product_profile':'non-physical-goods','cus_name':person['full_name'],
            'cus_email':person['email'],'cus_phone':person['phone'],
            'cus_add1':'Dhaka','cus_city':'Dhaka','cus_country':'Bangladesh'
        }
        try:
            r=httpx.post(self.base+'/gwprocess/v4/api.php',data=payload,timeout=self.cfg.request_timeout_seconds)
            r.raise_for_status();data=r.json()
        except (httpx.HTTPError, ValueError):
            fail(502,'Payment provider temporarily unavailable')
        url=data.get('GatewayPageURL','')
        if not url.startswith(self.base+'/'):
            fail(502,'Provider did not return an allowed hosted checkout URL')
        return {'checkoutUrl':url,'sessionId':str(data.get('sessionkey') or '')}
    def validate(self,val_id:str):
        try:
            r=httpx.get(self.base+'/validator/api/validationserverAPI.php',params={
              'val_id':val_id,'store_id':self.cfg.sslcommerz_store_id,
              'store_passwd':self.cfg.sslcommerz_store_password,'format':'json'},timeout=self.cfg.request_timeout_seconds)
            r.raise_for_status();data=r.json()
            if not isinstance(data,dict): raise ValueError('Invalid provider response')
            return data
        except (httpx.HTTPError,ValueError):
            fail(502,'Could not independently validate the payment')

def verified_amount(payload:dict,amount_bdt:int,reference:str)->bool:
    try:
        return (payload.get('status') in ('VALID','VALIDATED') and
          payload.get('tran_id')==reference and payload.get('currency')=='BDT' and
          Decimal(str(payload.get('amount')))==Decimal(amount_bdt))
    except (TypeError,InvalidOperation):
        return False
