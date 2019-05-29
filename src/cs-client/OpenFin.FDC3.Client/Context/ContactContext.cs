using OpenFin.FDC3.Constants;

namespace OpenFin.FDC3.Context
{
    public class ContactContext : ContextBase
    {
        public override string Type => ContextTypes.Contact;        
        public new Contact Id { get; set; }

        public ContactContext(string email, string phone, string twitter = "")
        {
            Id = new Contact
            {
                Email = email,
                Phone = phone,
                Twitter = twitter
            };
        }
    }
}