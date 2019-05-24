using Microsoft.VisualStudio.TestTools.UnitTesting;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace OpenFin.FDC3.Tests
{
    [TestClass()]
    public class DesktopAgentInitializedTests
    {
        [ClassInitialize()]
        public void Initialize()
        {

            DesktopAgent.Initialize();
           
        }

        //[TestMethod]
        //public async Task OpenAsync_OpeningNonExistantApplication_ThrowsException()
        //{
        //    await Assert.ThrowsExceptionAsync<Exception>(async () =>
        //    {
        //        await DesktopAgent.OpenAsync("TestApp");
        //    });
        //}
    }
}
